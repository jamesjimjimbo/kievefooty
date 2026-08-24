begin;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  2,'Second Serve','2026-08-28','2026-08-31',
  '2026-08-28 19:00:00+00','first','open',true,
  'Official 2026/27 Premier League Matchweek 2',false,'PL'
)
on conflict(number) do update set
  label=excluded.label,
  start_date=excluded.start_date,
  end_date=excluded.end_date,
  lock_at=excluded.lock_at,
  half=excluded.half,
  status=excluded.status,
  is_active_betting_week=excluded.is_active_betting_week,
  notes=excluded.notes,
  is_casino=excluded.is_casino,
  competition_code=excluded.competition_code;

with matchweek(home_name,away_name,kickoff_at,is_gotw) as (values
  ('Crystal Palace','Manchester City','2026-08-28 19:00:00+00'::timestamptz,false),
  ('Liverpool','Nottingham Forest','2026-08-29 11:30:00+00'::timestamptz,false),
  ('Bournemouth','Everton','2026-08-29 14:00:00+00'::timestamptz,false),
  ('Coventry City','Hull City','2026-08-29 14:00:00+00'::timestamptz,false),
  ('Tottenham Hotspur','Newcastle United','2026-08-29 16:30:00+00'::timestamptz,true),
  ('Chelsea','Brighton & Hove Albion','2026-08-30 13:00:00+00'::timestamptz,false),
  ('Leeds United','Brentford','2026-08-30 13:00:00+00'::timestamptz,false),
  ('Sunderland','Fulham','2026-08-30 13:00:00+00'::timestamptz,false),
  ('Manchester United','Ipswich Town','2026-08-30 15:30:00+00'::timestamptz,false),
  ('Aston Villa','Arsenal','2026-08-31 19:00:00+00'::timestamptz,false)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=2
join public.teams home on home.name=m.home_name
join public.teams away on away.name=m.away_name
where not exists (
  select 1 from public.fixtures f
  where f.competition_week_id=w.id
    and f.home_team_id=home.id
    and f.away_team_id=away.id
);

-- Keep the Game of the Week assignment deterministic if this migration is rerun.
update public.fixtures f
set is_gotw=false
from public.competition_weeks w
where f.competition_week_id=w.id and w.number=2 and f.is_gotw;

update public.fixtures f
set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id
  and w.number=2
  and f.home_team_id=home.id and home.name='Tottenham Hotspur'
  and f.away_team_id=away.id and away.name='Newcastle United';

-- Best available US 3-way prices from Oddschecker on 24 August 2026,
-- converted from American to decimal odds.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Crystal Palace','Manchester City',5.500::numeric,4.200::numeric,1.599::numeric),
  ('Liverpool','Nottingham Forest',1.500,4.750,6.500),
  ('Bournemouth','Everton',2.060,3.600,3.550),
  ('Coventry City','Hull City',1.893,3.700,4.200),
  ('Tottenham Hotspur','Newcastle United',2.250,3.600,3.200),
  ('Chelsea','Brighton & Hove Albion',2.050,3.700,3.650),
  ('Leeds United','Brentford',2.550,3.400,2.750),
  ('Sunderland','Fulham',2.600,3.400,2.750),
  ('Manchester United','Ipswich Town',1.426,5.100,7.000),
  ('Aston Villa','Arsenal',6.500,4.300,1.532)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,
  '2026-08-24 22:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=2
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-08-24 22:00:00+00'
);

commit;
