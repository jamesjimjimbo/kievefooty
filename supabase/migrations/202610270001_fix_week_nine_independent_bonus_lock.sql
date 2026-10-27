begin;

-- Bates-Colby is an independently timed bonus market. The ordinary Week 9
-- card stays open until the first eligible non-bonus fixture kicks off.
update public.competition_weeks w
set lock_at=(
  select min(f.kickoff_at)
  from public.fixtures f
  where f.competition_week_id=w.id
    and f.is_eligible
    and not f.is_manager_special
)
where w.number=9;

commit;
