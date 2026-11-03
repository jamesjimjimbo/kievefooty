create or replace function public.get_weekly_scores(p_week_id uuid)
returns table(user_id uuid,display_name text,weekly_score numeric)
language sql
stable
security definer
set search_path=public
as $$
  select p.id,p.display_name,coalesce(sum(l.amount),0)::numeric
  from public.profiles p
  left join public.points_ledger l
    on l.user_id=p.id and l.competition_week_id=p_week_id
  group by p.id,p.display_name
  order by coalesce(sum(l.amount),0) desc,p.display_name;
$$;

revoke all on function public.get_weekly_scores(uuid) from public;
grant execute on function public.get_weekly_scores(uuid) to authenticated;
