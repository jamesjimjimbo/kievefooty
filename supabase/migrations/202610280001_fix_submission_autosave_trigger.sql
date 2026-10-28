begin;

-- Core and bonus selections now save independently. The old trigger inspected
-- the submission's previous picks before the new core picks were written,
-- incorrectly rejecting valid 5+5 cards after a bonus-only save. Core stake
-- validation remains in submit_weekly_picks_v2.
create or replace function public.enforce_submission()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  wk public.competition_weeks;
  service_request boolean := coalesce(auth.jwt()->>'role','')='service_role';
begin
  select * into wk from public.competition_weeks where id=new.competition_week_id;
  if wk.id is null or not wk.is_active_betting_week or (now()>=wk.lock_at and not service_request) then
    raise exception 'Picks are locked';
  end if;
  if new.user_id<>auth.uid() and not service_request and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return new;
end
$$;

commit;
