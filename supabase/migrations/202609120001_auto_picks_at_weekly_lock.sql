begin;

create or replace function public.auto_submit_due_weekly_picks()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  due_week record;
  week_result jsonb;
  created_count integer:=0;
  checked_count integer:=0;
begin
  if current_user not in ('postgres','supabase_admin')
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'Service role required';
  end if;

  -- The existing auto-pick function and submission guard recognize service
  -- requests. pg_cron runs inside Postgres, so provide that claim locally.
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);

  for due_week in
    select id
    from public.competition_weeks
    where is_active_betting_week
      and status in ('open','locked')
      and lock_at<=now()
    order by lock_at,id
  loop
    week_result:=public.auto_submit_missing_weekly_picks(due_week.id);
    created_count:=created_count+coalesce((week_result->>'created')::integer,0);
    checked_count:=checked_count+1;

    update public.competition_weeks
    set status='locked'
    where id=due_week.id and status='open';
  end loop;

  return jsonb_build_object('weeks_checked',checked_count,'created',created_count);
end;
$$;

revoke all on function public.auto_submit_due_weekly_picks() from public,anon,authenticated;
grant execute on function public.auto_submit_due_weekly_picks() to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname='kievefooty-weekly-auto-picks';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'kievefooty-weekly-auto-picks',
    '* * * * *',
    'select public.auto_submit_due_weekly_picks()'
  );
end
$$;

commit;
