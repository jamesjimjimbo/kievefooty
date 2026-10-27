begin;

create or replace function public.save_weekly_special_pick(
  p_week_id uuid,
  p_fixture_id uuid,
  p_outcome public.outcome
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  bonus_fixture public.fixtures;
  latest_odds public.fixture_odds;
  submission uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into bonus_fixture
  from public.fixtures
  where id=p_fixture_id
    and competition_week_id=p_week_id
    and is_eligible
    and is_manager_special;

  if bonus_fixture.id is null then raise exception 'Invalid bonus fixture'; end if;
  if now()>=bonus_fixture.kickoff_at then raise exception 'This bonus bet is locked'; end if;

  select * into latest_odds
  from public.fixture_odds
  where fixture_id=p_fixture_id
  order by captured_at desc
  limit 1;
  if latest_odds.id is null then raise exception 'Bonus odds are not configured'; end if;

  insert into public.weekly_submissions(user_id,competition_week_id,source)
  values(auth.uid(),p_week_id,'manual')
  on conflict(user_id,competition_week_id)
  do update set submitted_at=now(),source='manual'
  returning id into submission;

  insert into public.picks(submission_id,fixture_id,kind,selected_outcome,stake,odds)
  values(
    submission,p_fixture_id,'special',p_outcome,
    case when bonus_fixture.provider_competition_code='MARATHON' then 10 else 5 end,
    case p_outcome when 'home' then latest_odds.home when 'draw' then latest_odds.draw else latest_odds.away end
  )
  on conflict(submission_id,fixture_id)
  do update set kind='special',selected_outcome=excluded.selected_outcome,
    stake=excluded.stake,odds=excluded.odds;

  return submission;
end $$;

revoke all on function public.save_weekly_special_pick(uuid,uuid,public.outcome) from public,anon;
grant execute on function public.save_weekly_special_pick(uuid,uuid,public.outcome) to authenticated;

commit;
