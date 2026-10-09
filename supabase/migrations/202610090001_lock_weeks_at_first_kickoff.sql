begin;

create or replace function public.set_week_lock_to_first_kickoff(p_week_id uuid)
returns void
language sql
security definer
set search_path=public
as $$
  update public.competition_weeks w
  set lock_at=first_fixture.kickoff_at
  from (
    select min(f.kickoff_at) as kickoff_at
    from public.fixtures f
    where f.competition_week_id=p_week_id
      and f.is_eligible
  ) first_fixture
  where w.id=p_week_id
    and first_fixture.kickoff_at is not null
    and w.end_date>=current_date
    and w.status in ('draft','open','locked');
$$;

create or replace function public.sync_week_lock_to_first_kickoff()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.set_week_lock_to_first_kickoff(old.competition_week_id);
    return old;
  end if;

  perform public.set_week_lock_to_first_kickoff(new.competition_week_id);

  if tg_op='UPDATE'
     and old.competition_week_id is distinct from new.competition_week_id then
    perform public.set_week_lock_to_first_kickoff(old.competition_week_id);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_week_lock_after_fixture_change on public.fixtures;
create trigger sync_week_lock_after_fixture_change
after insert or delete or update of kickoff_at,is_eligible,competition_week_id
on public.fixtures
for each row execute function public.sync_week_lock_to_first_kickoff();

-- Normalize all current and future betting weeks to their earliest eligible
-- fixture. This also moves Week 6 from Friday afternoon to Saturday's opener.
update public.competition_weeks w
set lock_at=first_fixture.kickoff_at
from (
  select f.competition_week_id,min(f.kickoff_at) as kickoff_at
  from public.fixtures f
  where f.is_eligible
  group by f.competition_week_id
) first_fixture
where first_fixture.competition_week_id=w.id
  and w.end_date>=current_date
  and w.status in ('draft','open','locked');

-- Week 6 auto-locked at its old Friday deadline. Reopen it so existing manual
-- and automatic cards can be replaced until the actual first kickoff.
update public.competition_weeks w
set status='open'
where w.number=6
  and w.lock_at>now()
  and w.status='locked';

commit;
