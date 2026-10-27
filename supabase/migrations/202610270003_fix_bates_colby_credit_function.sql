begin;

create or replace function public.award_bates_colby_abstention_credits()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  bonus_fixture public.fixtures;
  bonus_week_id uuid;
  awarded integer:=0;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service role required'; end if;

  select f.* into bonus_fixture
  from public.fixtures f
  join public.competition_weeks w on w.id=f.competition_week_id
  join public.teams home on home.id=f.home_team_id
  join public.teams away on away.id=f.away_team_id
  where w.number=9 and home.name='Colby' and away.name='Bates'
  limit 1;

  if bonus_fixture.id is null or now()<bonus_fixture.kickoff_at then return 0; end if;
  bonus_week_id:=bonus_fixture.competition_week_id;

  insert into public.points_ledger(user_id,competition_week_id,type,reference_type,reference_id,amount,metadata,description)
  select profile.id,bonus_week_id,'admin_adjustment','fixture',bonus_fixture.id,5,
    jsonb_build_object('reason','Bates-Colby abstention credit','policy','Positive choices for mental health','fixture_id',bonus_fixture.id),
    'Mental-health dividend for passing on Bates-Colby'
  from public.profiles profile
  where profile.created_at<bonus_fixture.kickoff_at
    and not exists(
      select 1 from public.weekly_submissions submission
      join public.picks pick on pick.submission_id=submission.id
      where submission.user_id=profile.id and submission.competition_week_id=bonus_week_id and pick.fixture_id=bonus_fixture.id
    )
  on conflict(user_id,type,reference_type,reference_id) do nothing;

  get diagnostics awarded=row_count;
  return awarded;
end $$;

revoke all on function public.award_bates_colby_abstention_credits() from public,anon,authenticated;
grant execute on function public.award_bates_colby_abstention_credits() to service_role;

commit;
