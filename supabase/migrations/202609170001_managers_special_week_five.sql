begin;

alter table public.fixtures
  add column if not exists is_manager_special boolean not null default false,
  add column if not exists provider_competition_code text;

create unique index if not exists one_manager_special_per_week
  on public.fixtures(competition_week_id) where is_manager_special;

alter table public.picks drop constraint if exists picks_kind_check;
alter table public.picks add constraint picks_kind_check check(kind in ('gotw','own','special'));

insert into public.teams(name,short_name) values
  ('Millwall','MIL'),
  ('West Ham United','WHU')
on conflict(name) do nothing;

with special(home_name,away_name,kickoff_at) as (values
  ('Millwall','West Ham United','2026-09-19 11:30:00+00'::timestamptz)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,
  is_gotw,is_manager_special,provider_competition_code
)
select w.id,home.id,away.id,s.kickoff_at,'scheduled',true,false,true,'ELC'
from special s
join public.competition_weeks w on w.number=5
join public.teams home on home.name=s.home_name
join public.teams away on away.name=s.away_name
where not exists(
  select 1 from public.fixtures f
  where f.competition_week_id=w.id
    and f.home_team_id=home.id and f.away_team_id=away.id
);

update public.fixtures f set is_manager_special=false
from public.competition_weeks w
where f.competition_week_id=w.id and w.number=5 and f.is_manager_special;

update public.fixtures f
set is_manager_special=true,is_eligible=true,provider_competition_code='ELC'
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id and w.number=5
  and f.home_team_id=home.id and home.name='Millwall'
  and f.away_team_id=away.id and away.name='West Ham United';

-- Oddschecker best 1X2 prices captured 17 September 2026:
-- Millwall 16/5 (4.20), draw 3/1 (4.00), West Ham 4/5 (1.80).
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,4.200,4.000,1.800,'2026-09-17 16:00:00+00',false
from public.fixtures f
join public.competition_weeks w on w.id=f.competition_week_id and w.number=5
where f.is_manager_special
  and not exists(
    select 1 from public.fixture_odds o
    where o.fixture_id=f.id and o.captured_at='2026-09-17 16:00:00+00'
  );

create or replace function public.enforce_submission()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  wk public.competition_weeks;
  base_total numeric;
  gotw_count integer;
  own_count integer;
  service_request boolean := coalesce(auth.jwt()->>'role','')='service_role';
begin
  select * into wk from public.competition_weeks where id=new.competition_week_id;
  if wk.id is null or not wk.is_active_betting_week or (now()>=wk.lock_at and not service_request) then
    raise exception 'Picks are locked';
  end if;
  if new.user_id<>auth.uid() and not service_request and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if tg_op='UPDATE' then
    select
      coalesce(sum(stake) filter(where kind in ('gotw','own')),0),
      count(*) filter(where kind='gotw'),
      count(*) filter(where kind='own')
    into base_total,gotw_count,own_count
    from public.picks where submission_id=new.id;
    if base_total<>10 or gotw_count<>1 or own_count<>1 then
      raise exception 'Two normal picks must total 10';
    end if;
  end if;
  return new;
end
$$;

create or replace function public.submit_weekly_picks(
  p_week_id uuid,p_gotw_fixture_id uuid,p_gotw_outcome public.outcome,p_gotw_stake numeric,
  p_own_fixture_id uuid,p_own_outcome public.outcome,p_own_stake numeric,
  p_special_fixture_id uuid,p_special_outcome public.outcome
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  wk public.competition_weeks;
  submission uuid;
  gotw public.fixture_odds;
  own public.fixture_odds;
  special public.fixture_odds;
  configured_special uuid;
  odds_multiplier numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into wk from public.competition_weeks where id=p_week_id for update;
  if wk.id is null or not wk.is_active_betting_week or now()>=wk.lock_at then raise exception 'Picks are locked'; end if;
  if p_gotw_stake<1 or p_own_stake<1 or p_gotw_stake+p_own_stake<>10 then raise exception 'Normal stakes must total exactly 10'; end if;
  if not exists(select 1 from public.fixtures where id=p_gotw_fixture_id and competition_week_id=p_week_id and is_eligible and is_gotw)
    or not exists(select 1 from public.fixtures where id=p_own_fixture_id and competition_week_id=p_week_id and is_eligible and not is_gotw and not is_manager_special)
    then raise exception 'Invalid fixtures'; end if;

  select id into configured_special from public.fixtures
  where competition_week_id=p_week_id and is_eligible and is_manager_special limit 1;
  if configured_special is not null and (p_special_fixture_id is distinct from configured_special or p_special_outcome is null) then
    raise exception 'Manager''s Special pick is required';
  end if;
  if configured_special is null and p_special_fixture_id is not null then raise exception 'Invalid special fixture'; end if;

  select * into gotw from public.fixture_odds where fixture_id=p_gotw_fixture_id order by captured_at desc limit 1;
  select * into own from public.fixture_odds where fixture_id=p_own_fixture_id order by captured_at desc limit 1;
  if configured_special is not null then
    select * into special from public.fixture_odds where fixture_id=configured_special order by captured_at desc limit 1;
    if special.id is null then raise exception 'Manager''s Special odds are not configured'; end if;
  end if;
  odds_multiplier:=case when wk.is_casino then 1+wk.casino_odds_boost else 1 end;

  insert into public.weekly_submissions(user_id,competition_week_id,source)
  values(auth.uid(),p_week_id,'manual')
  on conflict(user_id,competition_week_id) do update set submitted_at=now(),source='manual'
  returning id into submission;

  delete from public.picks where submission_id=submission;
  insert into public.picks(submission_id,fixture_id,kind,selected_outcome,stake,odds) values
    (submission,p_gotw_fixture_id,'gotw',p_gotw_outcome,p_gotw_stake,
      odds_multiplier*(case p_gotw_outcome when 'home' then gotw.home when 'draw' then gotw.draw else gotw.away end)),
    (submission,p_own_fixture_id,'own',p_own_outcome,p_own_stake,
      odds_multiplier*(case p_own_outcome when 'home' then own.home when 'draw' then own.draw else own.away end));
  if configured_special is not null then
    insert into public.picks(submission_id,fixture_id,kind,selected_outcome,stake,odds)
    values(submission,configured_special,'special',p_special_outcome,5,
      case p_special_outcome when 'home' then special.home when 'draw' then special.draw else special.away end);
  end if;
  return submission;
end $$;

-- Keep old clients safe: they may submit normal weeks, but cannot erase a configured special.
create or replace function public.submit_weekly_picks(
  p_week_id uuid,p_gotw_fixture_id uuid,p_gotw_outcome public.outcome,p_gotw_stake numeric,
  p_own_fixture_id uuid,p_own_outcome public.outcome,p_own_stake numeric
) returns uuid language plpgsql security definer set search_path=public as $$
begin
  return public.submit_weekly_picks(
    p_week_id,p_gotw_fixture_id,p_gotw_outcome,p_gotw_stake,
    p_own_fixture_id,p_own_outcome,p_own_stake,null,null
  );
end $$;

grant execute on function public.submit_weekly_picks(uuid,uuid,public.outcome,numeric,uuid,public.outcome,numeric,uuid,public.outcome) to authenticated;
grant execute on function public.submit_weekly_picks(uuid,uuid,public.outcome,numeric,uuid,public.outcome,numeric) to authenticated;

create or replace function public.auto_submit_missing_weekly_picks(p_week_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  wk public.competition_weeks;
  gotw_fixture public.fixtures;
  own_fixture public.fixtures;
  special_fixture public.fixtures;
  gotw_odds public.fixture_odds;
  own_odds public.fixture_odds;
  special_odds public.fixture_odds;
  member record;
  submission uuid;
  created_count integer := 0;
  special_count integer := 0;
  odds_multiplier numeric := 1;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service role required'; end if;
  select * into wk from public.competition_weeks where id=p_week_id for update;
  if wk.id is null then raise exception 'Competition week not found'; end if;
  if not wk.is_active_betting_week or wk.status='settled' or now()<wk.lock_at then
    return jsonb_build_object('created',0,'special_created',0,'skipped',true);
  end if;

  select * into gotw_fixture from public.fixtures
  where competition_week_id=p_week_id and is_eligible and is_gotw order by kickoff_at,id limit 1;
  select * into own_fixture from public.fixtures
  where competition_week_id=p_week_id and is_eligible and not is_gotw and not is_manager_special order by kickoff_at,id limit 1;
  select * into special_fixture from public.fixtures
  where competition_week_id=p_week_id and is_eligible and is_manager_special order by kickoff_at,id limit 1;
  if gotw_fixture.id is null or own_fixture.id is null then raise exception 'Auto-pick fixtures are not configured'; end if;

  select * into gotw_odds from public.fixture_odds where fixture_id=gotw_fixture.id order by captured_at desc limit 1;
  select * into own_odds from public.fixture_odds where fixture_id=own_fixture.id order by captured_at desc limit 1;
  if special_fixture.id is not null then
    select * into special_odds from public.fixture_odds where fixture_id=special_fixture.id order by captured_at desc limit 1;
  end if;
  if gotw_odds.id is null or own_odds.id is null or (special_fixture.id is not null and special_odds.id is null) then
    raise exception 'Auto-pick odds are not configured';
  end if;
  odds_multiplier:=case when wk.is_casino then 1+wk.casino_odds_boost else 1 end;

  for member in
    select p.id from public.profiles p
    where p.created_at<wk.lock_at and not exists(
      select 1 from public.weekly_submissions s where s.user_id=p.id and s.competition_week_id=p_week_id
    ) order by p.created_at,p.id
  loop
    submission:=null;
    insert into public.weekly_submissions(user_id,competition_week_id,source,submitted_at)
    values(member.id,p_week_id,'auto',wk.lock_at)
    on conflict(user_id,competition_week_id) do nothing returning id into submission;
    if submission is not null then
      insert into public.picks(submission_id,fixture_id,kind,selected_outcome,stake,odds) values
        (submission,gotw_fixture.id,'gotw','draw',5,odds_multiplier*gotw_odds.draw),
        (submission,own_fixture.id,'own','home',5,odds_multiplier*own_odds.home);
      created_count:=created_count+1;
    end if;
  end loop;

  if special_fixture.id is not null then
    insert into public.picks(submission_id,fixture_id,kind,selected_outcome,stake,odds)
    select s.id,special_fixture.id,'special','draw',5,special_odds.draw
    from public.weekly_submissions s
    where s.competition_week_id=p_week_id and not exists(
      select 1 from public.picks p where p.submission_id=s.id and p.kind='special'
    ) on conflict(submission_id,kind) do nothing;
    get diagnostics special_count=row_count;
  end if;

  return jsonb_build_object(
    'created',created_count,'special_created',special_count,
    'gotw_fixture_id',gotw_fixture.id,'own_fixture_id',own_fixture.id,'special_fixture_id',special_fixture.id
  );
end
$$;

revoke all on function public.auto_submit_missing_weekly_picks(uuid) from public,anon,authenticated;
grant execute on function public.auto_submit_missing_weekly_picks(uuid) to service_role;

commit;
