begin;

update public.competition_weeks
set is_active_betting_week=false
where number<>12 and is_active_betting_week;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  12,'City at the Emirates','2026-11-27','2026-11-29',
  '2026-11-27 20:00:00+00','first','open',true,
  'Premier League fixtures for 27-29 November 2026',false,'PL'
)
on conflict(number) do update set
  label=excluded.label,start_date=excluded.start_date,end_date=excluded.end_date,
  lock_at=excluded.lock_at,half=excluded.half,
  status=case when public.competition_weeks.status='settled' then 'settled'::public.week_status else excluded.status end,
  is_active_betting_week=excluded.is_active_betting_week,notes=excluded.notes,
  is_casino=excluded.is_casino,competition_code=excluded.competition_code;

with matchweek(home_name,away_name,kickoff_at,is_gotw) as (values
  ('Nottingham Forest','Chelsea','2026-11-27 20:00:00+00'::timestamptz,false),
  ('Leeds United','Coventry City','2026-11-28 15:00:00+00'::timestamptz,false),
  ('Manchester United','Brentford','2026-11-28 15:00:00+00'::timestamptz,false),
  ('Ipswich Town','Aston Villa','2026-11-28 17:30:00+00'::timestamptz,false),
  ('Everton','Liverpool','2026-11-29 12:00:00+00'::timestamptz,false),
  ('Brighton & Hove Albion','Newcastle United','2026-11-29 14:05:00+00'::timestamptz,false),
  ('Crystal Palace','Hull City','2026-11-29 14:05:00+00'::timestamptz,false),
  ('Fulham','Bournemouth','2026-11-29 14:05:00+00'::timestamptz,false),
  ('Sunderland','Tottenham Hotspur','2026-11-29 14:05:00+00'::timestamptz,false),
  ('Arsenal','Manchester City','2026-11-29 16:30:00+00'::timestamptz,true)
)
insert into public.fixtures(competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=12
join public.teams home on home.name=m.home_name
join public.teams away on away.name=m.away_name
where not exists(
  select 1 from public.fixtures f
  where f.competition_week_id=w.id and f.home_team_id=home.id and f.away_team_id=away.id
);

update public.fixtures f set is_gotw=false
from public.competition_weeks w
where f.competition_week_id=w.id and w.number=12 and f.is_gotw;

update public.fixtures f set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id and w.number=12
  and f.home_team_id=home.id and home.name='Arsenal'
  and f.away_team_id=away.id and away.name='Manchester City';

-- Best available full-time result prices captured from OddAlerts on 23 Nov.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Nottingham Forest','Chelsea',2.80::numeric,3.74::numeric,2.74::numeric),
  ('Leeds United','Coventry City',1.60,4.60,6.80),
  ('Manchester United','Brentford',2.14,4.08,3.62),
  ('Ipswich Town','Aston Villa',3.75,4.09,2.05),
  ('Everton','Liverpool',3.85,3.90,2.05),
  ('Brighton & Hove Albion','Newcastle United',1.63,4.70,5.70),
  ('Crystal Palace','Hull City',1.93,4.00,4.20),
  ('Fulham','Bournemouth',2.80,3.74,2.72),
  ('Sunderland','Tottenham Hotspur',3.65,3.64,2.24),
  ('Arsenal','Manchester City',2.08,3.86,3.80)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,'2026-11-23 18:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=12
join public.fixtures f
  on f.competition_week_id=w.id and f.home_team_id=home.id and f.away_team_id=away.id
where not exists(
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-11-23 18:00:00+00'
);

commit;
