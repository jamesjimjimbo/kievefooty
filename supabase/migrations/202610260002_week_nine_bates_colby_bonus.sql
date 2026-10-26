begin;

-- A week can now carry more than one fixed-stake bonus market.
drop index if exists public.one_manager_special_per_week;
alter table public.picks drop constraint if exists picks_submission_id_kind_key;
create unique index if not exists one_core_pick_per_kind
  on public.picks(submission_id,kind) where kind in ('gotw','own');
create unique index if not exists one_pick_per_submission_fixture
  on public.picks(submission_id,fixture_id);

insert into public.teams(name,short_name) values
  ('Colby','COLBY'),
  ('Bates','BATES')
on conflict(name) do update set short_name=excluded.short_name;

insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,
  is_gotw,is_manager_special,provider_competition_code
)
select w.id,colby.id,bates.id,'2026-10-27 19:00:00+00','scheduled',true,false,true,null
from public.competition_weeks w
join public.teams colby on colby.name='Colby'
join public.teams bates on bates.name='Bates'
where w.number=9
  and not exists(
    select 1 from public.fixtures f
    where f.competition_week_id=w.id
      and f.home_team_id=colby.id and f.away_team_id=bates.id
  );

update public.fixtures f
set is_manager_special=true,is_eligible=true,kickoff_at='2026-10-27 19:00:00+00'
from public.competition_weeks w,public.teams colby,public.teams bates
where f.competition_week_id=w.id and w.number=9
  and f.home_team_id=colby.id and colby.name='Colby'
  and f.away_team_id=bates.id and bates.name='Bates';

insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,2.55,3.05,2.70,'2026-10-26 20:00:00+00',false
from public.fixtures f
join public.competition_weeks w on w.id=f.competition_week_id and w.number=9
join public.teams home on home.id=f.home_team_id and home.name='Colby'
join public.teams away on away.id=f.away_team_id and away.name='Bates'
where not exists(
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-10-26 20:00:00+00'
);

create or replace function public.submit_weekly_picks_v2(
  p_week_id uuid,p_gotw_fixture_id uuid,p_gotw_outcome public.outcome,p_gotw_stake numeric,
  p_own_fixture_id uuid,p_own_outcome public.outcome,p_own_stake numeric,
  p_special_picks jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  wk public.competition_weeks;
  submission uuid;
  gotw public.fixture_odds;
  own public.fixture_odds;
  special_fixture public.fixtures;
  special_odds public.fixture_odds;
  special_item jsonb;
  special_outcome public.outcome;
  odds_multiplier numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into wk from public.competition_weeks where id=p_week_id for update;
  if wk.id is null or not wk.is_active_betting_week or now()>=wk.lock_at then raise exception 'Picks are locked'; end if;
  if p_gotw_stake<1 or p_own_stake<1 or p_gotw_stake+p_own_stake<>10 then raise exception 'Normal stakes must total exactly 10'; end if;
  if not exists(select 1 from public.fixtures where id=p_gotw_fixture_id and competition_week_id=p_week_id and is_eligible and is_gotw)
    or not exists(select 1 from public.fixtures where id=p_own_fixture_id and competition_week_id=p_week_id and is_eligible and not is_gotw and not is_manager_special)
    then raise exception 'Invalid fixtures'; end if;

  -- Every still-open bonus market is mandatory. Closed markets are preserved
  -- exactly as submitted and are not allowed to block edits to the core card.
  if exists(
    select 1 from public.fixtures f
    where f.competition_week_id=p_week_id and f.is_eligible and f.is_manager_special and now()<f.kickoff_at
      and not exists(
        select 1 from jsonb_array_elements(coalesce(p_special_picks,'[]'::jsonb)) item
        where item->>'fixtureId'=f.id::text and item->>'outcome' in ('home','draw','away')
      )
  ) then raise exception 'Every open bonus bet requires a pick'; end if;
  if exists(
    select 1 from jsonb_array_elements(coalesce(p_special_picks,'[]'::jsonb)) item
    where not exists(
      select 1 from public.fixtures f
      where f.id=(item->>'fixtureId')::uuid and f.competition_week_id=p_week_id
        and f.is_eligible and f.is_manager_special and now()<f.kickoff_at
    )
  ) then raise exception 'Invalid or locked bonus fixture'; end if;

  select * into gotw from public.fixture_odds where fixture_id=p_gotw_fixture_id order by captured_at desc limit 1;
  select * into own from public.fixture_odds where fixture_id=p_own_fixture_id order by captured_at desc limit 1;
  if gotw.id is null or own.id is null then raise exception 'Odds are not configured'; end if;
  odds_multiplier:=case when wk.is_casino then 1+wk.casino_odds_boost else 1 end;

  insert into public.weekly_submissions(user_id,competition_week_id,source)
  values(auth.uid(),p_week_id,'manual')
  on conflict(user_id,competition_week_id) do update set submitted_at=now(),source='manual'
  returning id into submission;

  delete from public.picks p
  using public.fixtures f
  where p.submission_id=submission and p.fixture_id=f.id
    and (p.kind in ('gotw','own') or (p.kind='special' and now()<f.kickoff_at));

  insert into public.picks(submission_id,fixture_id,kind,selected_outcome,stake,odds) values
    (submission,p_gotw_fixture_id,'gotw',p_gotw_outcome,p_gotw_stake,
      odds_multiplier*(case p_gotw_outcome when 'home' then gotw.home when 'draw' then gotw.draw else gotw.away end)),
    (submission,p_own_fixture_id,'own',p_own_outcome,p_own_stake,
      odds_multiplier*(case p_own_outcome when 'home' then own.home when 'draw' then own.draw else own.away end));

  for special_item in select * from jsonb_array_elements(coalesce(p_special_picks,'[]'::jsonb)) loop
    select * into special_fixture from public.fixtures
    where id=(special_item->>'fixtureId')::uuid and competition_week_id=p_week_id
      and is_eligible and is_manager_special and now()<kickoff_at;
    special_outcome:=(special_item->>'outcome')::public.outcome;
    select * into special_odds from public.fixture_odds where fixture_id=special_fixture.id order by captured_at desc limit 1;
    if special_odds.id is null then raise exception 'Bonus odds are not configured'; end if;
    insert into public.picks(submission_id,fixture_id,kind,selected_outcome,stake,odds)
    values(submission,special_fixture.id,'special',special_outcome,
      case when special_fixture.provider_competition_code='MARATHON' then 10 else 5 end,
      case special_outcome when 'home' then special_odds.home when 'draw' then special_odds.draw else special_odds.away end);
  end loop;
  return submission;
end $$;

revoke all on function public.submit_weekly_picks_v2(uuid,uuid,public.outcome,numeric,uuid,public.outcome,numeric,jsonb) from public,anon;
grant execute on function public.submit_weekly_picks_v2(uuid,uuid,public.outcome,numeric,uuid,public.outcome,numeric,jsonb) to authenticated;

update public.competition_weeks
set notes='Premier League fixtures for 31 October-2 November 2026, plus Bates-Colby and marathon bonus bets'
where number=9;

commit;
