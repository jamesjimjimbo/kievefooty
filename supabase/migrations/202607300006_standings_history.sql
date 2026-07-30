create or replace function public.get_standings_history()
returns table(
  week_number integer,
  week_label text,
  week_end date,
  user_id uuid,
  display_name text,
  score numeric
)
language sql
stable
security definer set search_path=public
as $$
  with visible_weeks as (
    select id,number,label,end_date
    from public.competition_weeks
    where is_active_betting_week
      and number is not null
      and status in ('settled','open','locked')
  )
  select
    w.number,
    w.label,
    w.end_date,
    p.id,
    p.display_name,
    coalesce(sum(l.amount) filter (
      where lw.number<=w.number
        and l.type in (
          'weekly_bet_win','weekly_bet_loss','challenge_win','challenge_loss',
          'streak_bonus','holiday_casino_win','holiday_casino_loss',
          'final_casino_win','final_casino_loss'
        )
    ),0)::numeric
  from visible_weeks w
  cross join public.profiles p
  left join public.points_ledger l on l.user_id=p.id
  left join public.competition_weeks lw on lw.id=l.competition_week_id
  group by w.number,w.label,w.end_date,p.id,p.display_name
  order by w.number,p.display_name;
$$;

grant execute on function public.get_standings_history() to authenticated;
