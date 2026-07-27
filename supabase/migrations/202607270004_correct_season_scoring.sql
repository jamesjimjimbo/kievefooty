alter table public.season_markets
  add column if not exists min_selections integer,
  add column if not exists payout_label text,
  add column if not exists scoring_type text not null default 'fixed_each'
    check (scoring_type in ('fixed_each','binary_each','odds_bet','table_movement','tbd')),
  add column if not exists wrong_points numeric(8,2) not null default 0,
  add column if not exists stake_points numeric(8,2) not null default 0;

alter table public.season_market_options
  add column if not exists odds numeric(8,3);

alter table public.season_markets
  drop constraint if exists season_markets_max_selections_check,
  drop constraint if exists season_markets_points_per_correct_check;

update public.season_markets
set min_selections=coalesce(min_selections,max_selections),
    payout_label=coalesce(payout_label,points_per_correct||' points per correct pick');

alter table public.season_markets
  alter column min_selections set not null,
  alter column payout_label set not null,
  add constraint season_market_selection_range
    check (min_selections between 0 and max_selections);

update public.season_markets set
  title='League champion',
  description='Pick the team that wins the league.',
  selection_help='Choose one champion',
  min_selections=1,max_selections=1,points_per_correct=100,
  payout_label='100 points if correct',scoring_type='fixed_each',wrong_points=0,stake_points=0
where slug='champion';

update public.season_markets set
  title='Top Four',
  description='Pick the other three teams that join your champion in the Champions League places.',
  selection_help='Choose three clubs besides your champion',
  min_selections=3,max_selections=3,points_per_correct=50,
  payout_label='50 points per correct club · 150 available',scoring_type='fixed_each',wrong_points=0,stake_points=0
where slug='top-four';

update public.season_markets set
  title='Fifth to seventh',
  description='Pick the three clubs that finish fifth, sixth, and seventh. Exact order does not matter.',
  selection_help='Choose three clubs',
  min_selections=3,max_selections=3,points_per_correct=25,
  payout_label='25 points per correct club · 75 available',scoring_type='fixed_each',wrong_points=0,stake_points=0
where slug='fifth-to-seventh';

update public.season_markets set
  title='Relegation',
  description='Pick the three clubs that finish in the bottom three. Exact order does not matter.',
  selection_help='Choose three clubs',
  min_selections=3,max_selections=3,points_per_correct=50,
  payout_label='50 points per correct club · 150 available',scoring_type='fixed_each',wrong_points=0,stake_points=0
where slug='relegation';

update public.season_markets set
  title='Manager sack market',
  description='Pick as many or as few clubs whose manager you think will be sacked. You may skip this market.',
  selection_help='Choose any number of clubs',
  min_selections=0,max_selections=20,points_per_correct=10,
  payout_label='+10 if sacked · −5 if the manager survives',scoring_type='binary_each',wrong_points=-5,stake_points=0
where slug='manager-exit';

update public.season_markets set
  title='Golden Boot',
  description='Wager 20 points on the Premier League top scorer at their preseason odds.',
  selection_help='Player list and odds open after squads are finalized',
  min_selections=1,max_selections=1,points_per_correct=0,
  payout_label='Win: 20 × preseason odds · Lose: −20',scoring_type='odds_bet',wrong_points=-20,stake_points=20
where slug='golden-boot';

update public.season_markets set
  title='Second-half mover',
  description='At the halfway point, pick one club to climb the table. Gain or lose five points per place moved from its January 1 position.',
  selection_help='Opens at the halfway point',
  min_selections=1,max_selections=1,points_per_correct=5,
  payout_label='±5 points per table place moved',scoring_type='table_movement',wrong_points=0,stake_points=0
where slug='january-mover';

update public.season_markets set
  title='Champions League Final',
  description='A single-match bet with details, stake, and odds posted before the final.',
  selection_help='Opens before the final',
  min_selections=1,max_selections=1,points_per_correct=0,
  payout_label='Stake and odds to be confirmed',scoring_type='tbd',wrong_points=0,stake_points=0
where slug='ucl-final';

alter table public.season_markets
  add constraint season_markets_max_selections_check
    check (max_selections between 1 and 20),
  add constraint season_markets_points_per_correct_check
    check (points_per_correct >= 0);

create table if not exists public.league_table_snapshots (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  captured_at timestamptz not null default now(),
  provider text not null,
  position integer not null check(position between 1 and 20),
  team_name text not null,
  played integer not null default 0,
  points integer not null default 0,
  unique(captured_at,position)
);

alter table public.league_table_snapshots enable row level security;
create policy "league reads table snapshots" on public.league_table_snapshots
  for select to authenticated using(true);
create policy "admin table snapshots" on public.league_table_snapshots
  for all using(public.is_admin()) with check(public.is_admin());

create or replace function public.submit_season_market_entry(p_market_id uuid,p_option_ids uuid[])
returns uuid
language plpgsql
security definer set search_path=public
as $$
declare
  market public.season_markets;
  entry_id uuid;
  valid_count integer;
  other_market_labels text[];
  selected_labels text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into market from public.season_markets where id=p_market_id for update;
  if market.id is null or market.status<>'open' or now()>=market.lock_at then
    raise exception 'This competition is not open';
  end if;
  if cardinality(p_option_ids)<market.min_selections or cardinality(p_option_ids)>market.max_selections then
    if market.min_selections=market.max_selections then
      raise exception 'Choose exactly % options',market.max_selections;
    end if;
    raise exception 'Choose between % and % options',market.min_selections,market.max_selections;
  end if;
  if cardinality(p_option_ids)<>cardinality(array(select distinct unnest(p_option_ids))) then
    raise exception 'Selections must be unique';
  end if;
  select count(*) into valid_count
  from public.season_market_options
  where market_id=p_market_id and id=any(p_option_ids);
  if valid_count<>cardinality(p_option_ids) then raise exception 'One or more selections are invalid'; end if;

  if market.slug in ('champion','top-four') then
    select array_agg(o.label) into other_market_labels
    from public.season_market_entries e
    join public.season_markets m on m.id=e.market_id
    cross join unnest(e.option_ids) selected_id
    join public.season_market_options o on o.id=selected_id
    where e.user_id=auth.uid()
      and m.slug=case when market.slug='champion' then 'top-four' else 'champion' end;
    select array_agg(label) into selected_labels
    from public.season_market_options where id=any(p_option_ids);
    if other_market_labels is not null and other_market_labels&&selected_labels then
      raise exception 'Your champion cannot also be one of your other Top Four selections';
    end if;
  end if;

  insert into public.season_market_entries(user_id,market_id,option_ids)
  values(auth.uid(),p_market_id,p_option_ids)
  on conflict(user_id,market_id) do update
    set option_ids=excluded.option_ids,submitted_at=now()
  returning id into entry_id;
  return entry_id;
end;
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
          'streak_bonus','holiday_casino_win','holiday_casino_loss',
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

grant execute on function public.submit_season_market_entry(uuid,uuid[]) to authenticated;
grant execute on function public.get_projected_standings() to authenticated;
