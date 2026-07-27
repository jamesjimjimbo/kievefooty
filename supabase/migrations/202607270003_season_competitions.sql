create table public.season_markets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  selection_help text not null,
  max_selections integer not null check (max_selections between 1 and 8),
  points_per_correct numeric(8,2) not null check (points_per_correct > 0),
  lock_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','open','locked','settled')),
  current_option_ids uuid[] not null default '{}',
  final_option_ids uuid[] not null default '{}',
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.season_market_options (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.season_markets(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  unique(market_id,label)
);

create table public.season_market_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.season_markets(id) on delete cascade,
  option_ids uuid[] not null,
  submitted_at timestamptz not null default now(),
  unique(user_id,market_id)
);

create or replace function public.submit_season_market_entry(p_market_id uuid,p_option_ids uuid[])
returns uuid
language plpgsql
security definer set search_path=public
as $$
declare
  market public.season_markets;
  entry_id uuid;
  valid_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into market from public.season_markets where id=p_market_id for update;
  if market.id is null or market.status<>'open' or now()>=market.lock_at then
    raise exception 'This competition is not open';
  end if;
  if cardinality(p_option_ids)<>market.max_selections then
    raise exception 'Choose exactly % options',market.max_selections;
  end if;
  if cardinality(p_option_ids)<>cardinality(array(select distinct unnest(p_option_ids))) then
    raise exception 'Selections must be unique';
  end if;
  select count(*) into valid_count
  from public.season_market_options
  where market_id=p_market_id and id=any(p_option_ids);
  if valid_count<>market.max_selections then raise exception 'One or more selections are invalid'; end if;

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
  projected as (
    select e.user_id,
      coalesce(sum(
        m.points_per_correct *
        (select count(*) from unnest(e.option_ids) selected_id
          where selected_id=any(m.current_option_ids))
      ),0)::numeric as season_projection
    from public.season_market_entries e
    join public.season_markets m on m.id=e.market_id
    where m.status in ('open','locked') and cardinality(m.current_option_ids)>0
    group by e.user_id
  )
  select b.id,b.display_name,b.score+coalesce(p.season_projection,0),coalesce(p.season_projection,0)
  from base b
  left join projected p on p.user_id=b.id
  order by 3 desc,b.display_name;
$$;

create or replace function public.get_standings(p_half public.competition_half default null)
returns table(user_id uuid, display_name text, score numeric)
language sql stable security definer set search_path=public
as $$
  select p.id, p.display_name,
    coalesce(sum(l.amount) filter (
      where
        case
          when p_half is not null then l.type in ('weekly_bet_win','weekly_bet_loss')
            and w.half = p_half
          else l.type in (
            'weekly_bet_win','weekly_bet_loss','challenge_win','challenge_loss',
            'streak_bonus','holiday_casino_win','holiday_casino_loss',
            'final_casino_win','final_casino_loss','manager_sack',
            'manager_survival','season_prediction','golden_boot',
            'january_mover','ucl_final'
          )
        end
    ), 0)::numeric as score
  from profiles p
  left join points_ledger l on l.user_id=p.id
  left join competition_weeks w on w.id=l.competition_week_id
  group by p.id,p.display_name
  order by score desc,p.display_name;
$$;

alter table public.season_markets enable row level security;
alter table public.season_market_options enable row level security;
alter table public.season_market_entries enable row level security;

create policy "league reads season markets" on public.season_markets
  for select to authenticated using(true);
create policy "league reads market options" on public.season_market_options
  for select to authenticated using(true);
create policy "read own or locked season entries" on public.season_market_entries
  for select to authenticated using (
    user_id=auth.uid() or exists(
      select 1 from public.season_markets m
      where m.id=market_id and (m.status in ('locked','settled') or now()>=m.lock_at)
    )
  );
create policy "admin season markets" on public.season_markets
  for all using(public.is_admin()) with check(public.is_admin());
create policy "admin market options" on public.season_market_options
  for all using(public.is_admin()) with check(public.is_admin());
create policy "admin season entries" on public.season_market_entries
  for all using(public.is_admin()) with check(public.is_admin());

grant execute on function public.submit_season_market_entry(uuid,uuid[]) to authenticated;
grant execute on function public.get_projected_standings() to authenticated;
grant execute on function public.get_standings(public.competition_half) to authenticated;

insert into public.teams(name,short_name) values
  ('Arsenal','ARS'),('Aston Villa','AVL'),('Bournemouth','BOU'),('Brentford','BRE'),
  ('Brighton & Hove Albion','BHA'),('Chelsea','CHE'),('Coventry City','COV'),
  ('Crystal Palace','CRY'),('Everton','EVE'),('Fulham','FUL'),('Hull City','HUL'),
  ('Ipswich Town','IPS'),('Leeds United','LEE'),('Liverpool','LIV'),
  ('Manchester City','MCI'),('Manchester United','MUN'),('Newcastle United','NEW'),
  ('Nottingham Forest','NFO'),('Sunderland','SUN'),('Tottenham Hotspur','TOT')
on conflict do nothing;

insert into public.season_markets(
  slug,title,description,selection_help,max_selections,points_per_correct,lock_at,status,display_order
) values
  ('champion','League champion','Pick the team that finishes first.','Choose one club',1,20,'2026-08-21 19:00:00+00','open',10),
  ('top-four','Top four','Name the four clubs that finish in the Champions League places.','Choose four clubs',4,5,'2026-08-21 19:00:00+00','open',20),
  ('fifth-to-seventh','Fifth to seventh','Pick the three clubs that occupy places five through seven.','Choose three clubs',3,5,'2026-08-21 19:00:00+00','open',30),
  ('relegation','Relegation','Pick the three clubs that go down.','Choose three clubs',3,5,'2026-08-21 19:00:00+00','open',40),
  ('manager-exit','First manager exit','Pick the club whose manager leaves first.','Choose one club',1,15,'2026-08-21 19:00:00+00','open',50),
  ('golden-boot','Golden Boot','Pick the Premier League top scorer.','Player list opens after squads are finalized',1,20,'2026-08-21 19:00:00+00','draft',60),
  ('january-mover','January mover','Pick the team that climbs the most places during January.','Rules and field open in December',1,15,'2026-12-31 12:00:00+00','draft',70),
  ('ucl-final','Champions League Final','Pick the two clubs that reach the final.','Field opens after the league phase draw',2,10,'2026-09-15 12:00:00+00','draft',80)
on conflict(slug) do nothing;

insert into public.season_market_options(market_id,label,sort_order)
select m.id,t.name,row_number() over(partition by m.id order by t.name)
from public.season_markets m
cross join public.teams t
where m.slug in ('champion','top-four','fifth-to-seventh','relegation','manager-exit')
on conflict(market_id,label) do nothing;
