begin;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  4,'Derby Day','2026-09-12','2026-09-14',
  '2026-09-12 14:00:00+00','first','open',true,
  'Official 2026/27 Premier League Matchweek 4',false,'PL'
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
  ('Bournemouth','Brentford','2026-09-12 14:00:00+00'::timestamptz,false),
  ('Aston Villa','Nottingham Forest','2026-09-12 14:00:00+00'::timestamptz,false),
  ('Chelsea','Hull City','2026-09-12 14:00:00+00'::timestamptz,false),
  ('Crystal Palace','Ipswich Town','2026-09-12 14:00:00+00'::timestamptz,false),
  ('Liverpool','Fulham','2026-09-12 14:00:00+00'::timestamptz,false),
  ('Tottenham Hotspur','Everton','2026-09-12 16:30:00+00'::timestamptz,false),
  ('Sunderland','Arsenal','2026-09-12 19:00:00+00'::timestamptz,false),
  ('Coventry City','Brighton & Hove Albion','2026-09-13 13:00:00+00'::timestamptz,false),
  ('Manchester United','Manchester City','2026-09-13 15:30:00+00'::timestamptz,true),
  ('Leeds United','Newcastle United','2026-09-14 19:00:00+00'::timestamptz,false)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=4
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
where f.competition_week_id=w.id and w.number=4 and f.is_gotw;

update public.fixtures f
set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id
  and w.number=4
  and f.home_team_id=home.id and home.name='Manchester United'
  and f.away_team_id=away.id and away.name='Manchester City';

-- Best available three-way prices from Oddschecker on 8 September 2026,
-- converted from fractional to decimal odds.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Bournemouth','Brentford',2.500::numeric,3.750::numeric,2.700::numeric),
  ('Aston Villa','Nottingham Forest',2.200,3.500,3.300),
  ('Chelsea','Hull City',1.250,6.500,13.000),
  ('Crystal Palace','Ipswich Town',1.900,3.800,4.000),
  ('Liverpool','Fulham',1.444,5.000,6.500),
  ('Tottenham Hotspur','Everton',2.050,3.600,3.750),
  ('Sunderland','Arsenal',7.000,4.200,1.500),
  ('Coventry City','Brighton & Hove Albion',4.200,3.800,1.846),
  ('Manchester United','Manchester City',3.100,4.000,2.154),
  ('Leeds United','Newcastle United',2.455,3.600,2.875)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,
  '2026-09-08 18:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=4
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-09-08 18:00:00+00'
);

commit;
