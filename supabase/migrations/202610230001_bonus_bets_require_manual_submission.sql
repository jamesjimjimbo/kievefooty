begin;

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

  -- Bonus markets reward participation. Only people who submitted a manual
  -- weekly card can receive a missing fixed-stake bonus pick at lock.
  if special_fixture.id is not null then
    insert into public.picks(submission_id,fixture_id,kind,selected_outcome,stake,odds)
    select s.id,special_fixture.id,'special','draw',5,special_odds.draw
    from public.weekly_submissions s
    where s.competition_week_id=p_week_id
      and s.source='manual'
      and not exists(
        select 1 from public.picks p where p.submission_id=s.id and p.kind='special'
      )
    on conflict(submission_id,kind) do nothing;
    get diagnostics special_count=row_count;
  end if;

  return jsonb_build_object(
    'created',created_count,'special_created',special_count,
    'gotw_fixture_id',gotw_fixture.id,'own_fixture_id',own_fixture.id,'special_fixture_id',special_fixture.id
  );
end
$$;

commit;
