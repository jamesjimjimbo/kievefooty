begin;

alter table public.competition_weeks
  add column if not exists competition_code text not null default 'PL'
  check (competition_code in ('PL','FAC'));

drop function if exists public.get_standings_history();

create function public.get_standings_history()
returns table(
  week_number integer,
  week_label text,
  week_end date,
  user_id uuid,
  display_name text,
  first_score numeric,
  second_score numeric,
  full_score numeric,
  accuracy_correct integer
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
  ),
  ledger_history as (
    select
      w.number,
      p.id user_id,
      coalesce(sum(l.amount) filter (
        where lw.number<=w.number and lw.half='first'
          and l.type in ('weekly_bet_win','weekly_bet_loss')
      ),0)::numeric first_score,
      coalesce(sum(l.amount) filter (
        where lw.number<=w.number and lw.half='second'
          and l.type in ('weekly_bet_win','weekly_bet_loss')
      ),0)::numeric second_score,
      coalesce(sum(l.amount) filter (
        where (
          lw.number<=w.number
          or (l.competition_week_id is null and l.created_at<w.end_date+interval '1 day')
        )
          and l.type<>'weekly_credit'
      ),0)::numeric full_score
    from visible_weeks w
    cross join public.profiles p
    left join public.points_ledger l on l.user_id=p.id
    left join public.competition_weeks lw on lw.id=l.competition_week_id
    group by w.number,w.end_date,p.id
  ),
  accuracy_history as (
    select
      w.number,
      p.id user_id,
      count(pk.id) filter (
        where sw.number<=w.number and pk.is_correct=true
      )::integer accuracy_correct
    from visible_weeks w
    cross join public.profiles p
    left join public.weekly_submissions s on s.user_id=p.id
    left join public.competition_weeks sw on sw.id=s.competition_week_id
    left join public.picks pk on pk.submission_id=s.id
    group by w.number,p.id
  )
  select
    w.number,w.label,w.end_date,p.id,p.display_name,
    l.first_score,l.second_score,l.full_score,a.accuracy_correct
  from visible_weeks w
  cross join public.profiles p
  join ledger_history l on l.number=w.number and l.user_id=p.id
  join accuracy_history a on a.number=w.number and a.user_id=p.id
  order by w.number,p.display_name;
$$;

grant execute on function public.get_standings_history() to authenticated;

commit;
