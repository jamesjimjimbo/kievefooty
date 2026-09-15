begin;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  5,'The Turd Bowl','2026-09-18','2026-09-20',
  '2026-09-18 19:00:00+00','first','open',true,
  'Official 2026/27 Premier League Matchweek 5',false,'PL'
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
  ('Brentford','Chelsea','2026-09-18 19:00:00+00'::timestamptz,false),
  ('Tottenham Hotspur','Aston Villa','2026-09-19 11:30:00+00'::timestamptz,true),
  ('Brighton & Hove Albion','Arsenal','2026-09-19 14:00:00+00'::timestamptz,false),
  ('Everton','Ipswich Town','2026-09-19 14:00:00+00'::timestamptz,false),
  ('Newcastle United','Hull City','2026-09-19 14:00:00+00'::timestamptz,false),
  ('Nottingham Forest','Coventry City','2026-09-19 16:30:00+00'::timestamptz,false),
  ('Bournemouth','Liverpool','2026-09-20 13:00:00+00'::timestamptz,false),
  ('Leeds United','Crystal Palace','2026-09-20 13:00:00+00'::timestamptz,false),
  ('Manchester City','Sunderland','2026-09-20 13:00:00+00'::timestamptz,false),
  ('Fulham','Manchester United','2026-09-20 15:30:00+00'::timestamptz,false)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=5
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
where f.competition_week_id=w.id and w.number=5 and f.is_gotw;

update public.fixtures f
set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id
  and w.number=5
  and f.home_team_id=home.id and home.name='Tottenham Hotspur'
  and f.away_team_id=away.id and away.name='Aston Villa';

-- Best available three-way prices from Oddschecker on 15 September 2026,
-- converted from fractional to decimal odds.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Brentford','Chelsea',3.053::numeric,3.800::numeric,2.250::numeric),
  ('Tottenham Hotspur','Aston Villa',2.000,3.750,3.800),
  ('Brighton & Hove Albion','Arsenal',5.000,3.900,1.727),
  ('Everton','Ipswich Town',1.800,3.800,4.500),
  ('Newcastle United','Hull City',1.615,4.333,5.750),
  ('Nottingham Forest','Coventry City',1.667,4.000,5.000),
  ('Bournemouth','Liverpool',3.200,3.900,2.154),
  ('Leeds United','Crystal Palace',1.833,3.750,4.400),
  ('Manchester City','Sunderland',1.300,5.750,12.000),
  ('Fulham','Manchester United',3.400,3.800,2.000)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,
  '2026-09-15 18:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=5
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-09-15 18:00:00+00'
);

commit;
