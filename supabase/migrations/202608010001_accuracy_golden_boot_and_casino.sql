begin;

alter table public.competition_weeks
  add column if not exists casino_odds_boost numeric(5,4) not null default 0.05
  check (casino_odds_boost between 0 and 0.25);

update public.competition_weeks
set casino_odds_boost=0.05
where is_casino;

update public.season_markets
set
  title='Golden Boot top three',
  description='Pick the three players who finish first, second, or third in the Premier League scoring chart. Exact order does not matter.',
  selection_help='Choose three goalscorers',
  min_selections=3,
  max_selections=3,
  points_per_correct=20,
  payout_label='20 points per correct player · 60 available',
  scoring_type='fixed_each',
  wrong_points=0,
  stake_points=0
where slug='golden-boot';

update public.season_market_options o
set odds=null
from public.season_markets m
where o.market_id=m.id and m.slug='golden-boot';

create or replace function public.submit_weekly_picks(
  p_week_id uuid, p_gotw_fixture_id uuid, p_gotw_outcome public.outcome, p_gotw_stake numeric,
  p_own_fixture_id uuid, p_own_outcome public.outcome, p_own_stake numeric
) returns uuid language plpgsql security definer set search_path=public as $$
declare wk competition_weeks; submission uuid; gotw fixture_odds; own fixture_odds; odds_multiplier numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into wk from competition_weeks where id=p_week_id for update;
  if wk.id is null or not wk.is_active_betting_week or now()>=wk.lock_at then raise exception 'Picks are locked'; end if;
  if p_gotw_stake<1 or p_own_stake<1 or p_gotw_stake+p_own_stake<>10 then raise exception 'Stakes must total exactly 10'; end if;
  if not exists(select 1 from fixtures where id=p_gotw_fixture_id and competition_week_id=p_week_id and is_eligible and is_gotw)
    or not exists(select 1 from fixtures where id=p_own_fixture_id and competition_week_id=p_week_id and is_eligible and not is_gotw)
    then raise exception 'Invalid fixtures'; end if;
  select * into gotw from fixture_odds where fixture_id=p_gotw_fixture_id order by captured_at desc limit 1;
  select * into own from fixture_odds where fixture_id=p_own_fixture_id order by captured_at desc limit 1;
  odds_multiplier:=case when wk.is_casino then 1+wk.casino_odds_boost else 1 end;
  insert into weekly_submissions(user_id,competition_week_id,source) values(auth.uid(),p_week_id,'manual')
    on conflict(user_id,competition_week_id) do update set submitted_at=now(),source='manual' returning id into submission;
  delete from picks where submission_id=submission;
  insert into picks(submission_id,fixture_id,kind,selected_outcome,stake,odds) values
    (submission,p_gotw_fixture_id,'gotw',p_gotw_outcome,p_gotw_stake,
      odds_multiplier*(case p_gotw_outcome when 'home' then gotw.home when 'draw' then gotw.draw else gotw.away end)),
    (submission,p_own_fixture_id,'own',p_own_outcome,p_own_stake,
      odds_multiplier*(case p_own_outcome when 'home' then own.home when 'draw' then own.draw else own.away end));
  return submission;
end $$;

grant execute on function public.submit_weekly_picks(uuid,uuid,public.outcome,numeric,uuid,public.outcome,numeric) to authenticated;

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
  accuracy_rate numeric
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
      coalesce(round(
        100.0*count(pk.id) filter (where sw.number<=w.number and pk.is_correct=true)
        /nullif(count(pk.id) filter (where sw.number<=w.number and pk.is_correct is not null),0),
        1
      ),0)::numeric accuracy_rate
    from visible_weeks w
    cross join public.profiles p
    left join public.weekly_submissions s on s.user_id=p.id
    left join public.competition_weeks sw on sw.id=s.competition_week_id
    left join public.picks pk on pk.submission_id=s.id
    group by w.number,p.id
  )
  select
    w.number,w.label,w.end_date,p.id,p.display_name,
    l.first_score,l.second_score,l.full_score,a.accuracy_rate
  from visible_weeks w
  cross join public.profiles p
  join ledger_history l on l.number=w.number and l.user_id=p.id
  join accuracy_history a on a.number=w.number and a.user_id=p.id
  order by w.number,p.display_name;
$$;

grant execute on function public.get_standings_history() to authenticated;

commit;
