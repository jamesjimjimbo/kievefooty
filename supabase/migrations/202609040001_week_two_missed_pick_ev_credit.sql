with target_week as (
  select id,lock_at
  from public.competition_weeks
  where number=2
)
insert into public.points_ledger(
  user_id,
  competition_week_id,
  type,
  reference_type,
  reference_id,
  amount,
  metadata,
  description
)
select
  p.id,
  w.id,
  'admin_adjustment',
  'missed_week_ev',
  w.id,
  8,
  jsonb_build_object('reason','Week 2 missed-pick EV credit','points',8),
  'Week 2 missed-pick EV credit'
from public.profiles p
cross join target_week w
where p.created_at<w.lock_at
  and not exists(
    select 1
    from public.weekly_submissions s
    where s.user_id=p.id and s.competition_week_id=w.id
  )
on conflict(user_id,type,reference_type,reference_id)
do update set
  amount=excluded.amount,
  metadata=excluded.metadata,
  description=excluded.description;

create or replace function public.get_standings(p_half public.competition_half default null)
returns table(user_id uuid, display_name text, score numeric)
language sql stable security definer set search_path=public
as $$
  select p.id, p.display_name,
    coalesce(sum(l.amount) filter (
      where
        case
          when p_half is not null then l.type in ('weekly_bet_win','weekly_bet_loss','admin_adjustment')
            and w.half = p_half
          else l.type in (
            'weekly_bet_win','weekly_bet_loss','challenge_win','challenge_loss',
            'streak_bonus','admin_adjustment','holiday_casino_win','holiday_casino_loss',
            'final_casino_win','final_casino_loss','manager_sack',
            'manager_survival','season_prediction','golden_boot',
            'january_mover','ucl_final'
          )
        end
    ), 0)::numeric as score
  from public.profiles p
  left join public.points_ledger l on l.user_id=p.id
  left join public.competition_weeks w on w.id=l.competition_week_id
  group by p.id,p.display_name
  order by score desc,p.display_name;
$$;

create or replace function public.get_projected_standings()
returns table(user_id uuid,display_name text,score numeric,season_projection numeric)
language sql
stable
security definer set search_path=public
as $$
  with base as (
    select p.id,p.display_name,
      coalesce(sum(l.amount) filter (
        where l.type in (
          'weekly_bet_win','weekly_bet_loss','challenge_win','challenge_loss',
          'streak_bonus','admin_adjustment','holiday_casino_win','holiday_casino_loss',
          'final_casino_win','final_casino_loss','manager_sack',
          'manager_survival','season_prediction','golden_boot',
          'january_mover','ucl_final'
        )
      ),0)::numeric as score
    from public.profiles p
    left join public.points_ledger l on l.user_id=p.id
    group by p.id,p.display_name
  ),
  latest_capture as (
    select max(captured_at) captured_at from public.league_table_snapshots
  ),
  latest_table as (
    select s.* from public.league_table_snapshots s
    join latest_capture c on c.captured_at=s.captured_at
  ),
  automatic_results as (
    select m.id market_id,array_agg(o.id order by t.position) option_ids
    from public.season_markets m
    join public.season_market_options o on o.market_id=m.id
    join latest_table t on lower(t.team_name)=lower(o.label)
    where
      (m.slug='champion' and t.position=1) or
      (m.slug='top-four' and t.position between 2 and 4) or
      (m.slug='fifth-to-seventh' and t.position between 5 and 7) or
      (m.slug='relegation' and t.position between 18 and 20)
    group by m.id
  ),
  scored_entries as (
    select e.user_id,m.id,
      case m.scoring_type
        when 'fixed_each' then m.points_per_correct*(
          select count(*) from unnest(e.option_ids) selected_id
          where selected_id=any(coalesce(a.option_ids,m.current_option_ids))
        )
        when 'binary_each' then
          m.points_per_correct*(
            select count(*) from unnest(e.option_ids) selected_id
            where selected_id=any(m.current_option_ids)
          )+
          m.wrong_points*(
            cardinality(e.option_ids)-(
              select count(*) from unnest(e.option_ids) selected_id
              where selected_id=any(m.current_option_ids)
            )
          )
        when 'odds_bet' then case
          when cardinality(m.current_option_ids)=0 then 0
          when e.option_ids[1]=any(m.current_option_ids)
            then m.stake_points*coalesce((select odds from public.season_market_options where id=e.option_ids[1]),0)
          else m.wrong_points end
        else 0
      end::numeric projected_points
    from public.season_market_entries e
    join public.season_markets m on m.id=e.market_id
    left join automatic_results a on a.market_id=m.id
    where m.status in ('open','locked')
      and (
        cardinality(coalesce(a.option_ids,m.current_option_ids))>0
        or m.scoring_type='binary_each'
      )
  ),
  projected as (
    select user_id,coalesce(sum(projected_points),0)::numeric season_projection
    from scored_entries group by user_id
  )
  select b.id,b.display_name,b.score+coalesce(p.season_projection,0),coalesce(p.season_projection,0)
  from base b left join projected p on p.user_id=b.id
  order by 3 desc,b.display_name;
$$;

create or replace function public.get_standings_history()
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
          and l.type in ('weekly_bet_win','weekly_bet_loss','admin_adjustment')
      ),0)::numeric first_score,
      coalesce(sum(l.amount) filter (
        where lw.number<=w.number and lw.half='second'
          and l.type in ('weekly_bet_win','weekly_bet_loss','admin_adjustment')
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

grant execute on function public.get_standings(public.competition_half) to authenticated;
grant execute on function public.get_projected_standings() to authenticated;
grant execute on function public.get_standings_history() to authenticated;
