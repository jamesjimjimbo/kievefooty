begin;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  6,'Back From Break','2026-10-10','2026-10-12',
  '2026-10-09 19:00:00+00','first','open',true,
  'Premier League fixtures for 10-12 October 2026',false,'PL'
)
on conflict(number) do update set
  label=excluded.label,
  start_date=excluded.start_date,
  end_date=excluded.end_date,
  lock_at=excluded.lock_at,
  half=excluded.half,
  status=case
    when public.competition_weeks.status='settled' then 'settled'::public.week_status
    else excluded.status
  end,
  is_active_betting_week=excluded.is_active_betting_week,
  notes=excluded.notes,
  is_casino=excluded.is_casino,
  competition_code=excluded.competition_code;

with matchweek(home_name,away_name,kickoff_at,is_gotw) as (values
  ('Arsenal','Leeds United','2026-10-10 11:30:00+00'::timestamptz,false),
  ('Aston Villa','Brentford','2026-10-10 14:00:00+00'::timestamptz,false),
  ('Chelsea','Bournemouth','2026-10-10 14:00:00+00'::timestamptz,false),
  ('Ipswich Town','Fulham','2026-10-10 14:00:00+00'::timestamptz,false),
  ('Sunderland','Brighton & Hove Albion','2026-10-10 14:00:00+00'::timestamptz,false),
  ('Manchester United','Tottenham Hotspur','2026-10-10 16:30:00+00'::timestamptz,false),
  ('Crystal Palace','Nottingham Forest','2026-10-11 13:00:00+00'::timestamptz,false),
  ('Hull City','Everton','2026-10-11 13:00:00+00'::timestamptz,false),
  ('Liverpool','Manchester City','2026-10-11 15:30:00+00'::timestamptz,true),
  ('Coventry City','Newcastle United','2026-10-12 19:00:00+00'::timestamptz,false)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=6
join public.teams home on home.name=m.home_name
join public.teams away on away.name=m.away_name
where not exists (
  select 1 from public.fixtures f
  where f.competition_week_id=w.id
    and f.home_team_id=home.id
    and f.away_team_id=away.id
);

update public.fixtures f
set is_gotw=false
from public.competition_weeks w
where f.competition_week_id=w.id and w.number=6 and f.is_gotw;

update public.fixtures f
set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id
  and w.number=6
  and f.home_team_id=home.id and home.name='Liverpool'
  and f.away_team_id=away.id and away.name='Manchester City';

-- Current three-way prices from BetVictor on 5 October 2026,
-- converted from fractional to decimal odds.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Arsenal','Leeds United',1.333::numeric,4.800::numeric,8.500::numeric),
  ('Aston Villa','Brentford',2.600,3.500,2.450),
  ('Chelsea','Bournemouth',1.750,4.100,3.900),
  ('Ipswich Town','Fulham',2.600,3.500,2.500),
  ('Sunderland','Brighton & Hove Albion',2.750,3.400,2.400),
  ('Manchester United','Tottenham Hotspur',1.667,4.100,4.333),
  ('Crystal Palace','Nottingham Forest',2.600,3.250,2.600),
  ('Hull City','Everton',3.500,3.300,2.050),
  ('Liverpool','Manchester City',2.875,3.700,2.200),
  ('Coventry City','Newcastle United',3.200,3.600,2.050)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,
  '2026-10-05 18:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=6
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-10-05 18:00:00+00'
);

commit;
