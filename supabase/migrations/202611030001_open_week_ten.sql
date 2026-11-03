begin;

update public.competition_weeks
set is_active_betting_week=false
where number<>10 and is_active_betting_week;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  10,'Elland Road Reckoning','2026-11-06','2026-11-08',
  '2026-11-06 20:00:00+00','first','open',true,
  'Premier League fixtures for 6-8 November 2026',false,'PL'
)
on conflict(number) do update set
  label=excluded.label,start_date=excluded.start_date,end_date=excluded.end_date,
  lock_at=excluded.lock_at,half=excluded.half,
  status=case when public.competition_weeks.status='settled' then 'settled'::public.week_status else excluded.status end,
  is_active_betting_week=excluded.is_active_betting_week,notes=excluded.notes,
  is_casino=excluded.is_casino,competition_code=excluded.competition_code;

with matchweek(home_name,away_name,kickoff_at,is_gotw) as (values
  ('Everton','Coventry City','2026-11-06 20:00:00+00'::timestamptz,false),
  ('Leeds United','Tottenham Hotspur','2026-11-07 12:30:00+00'::timestamptz,true),
  ('Arsenal','Hull City','2026-11-07 15:00:00+00'::timestamptz,false),
  ('Fulham','Newcastle United','2026-11-07 15:00:00+00'::timestamptz,false),
  ('Nottingham Forest','Manchester City','2026-11-07 17:30:00+00'::timestamptz,false),
  ('Brighton & Hove Albion','Brentford','2026-11-08 14:00:00+00'::timestamptz,false),
  ('Crystal Palace','Liverpool','2026-11-08 14:00:00+00'::timestamptz,false),
  ('Ipswich Town','Bournemouth','2026-11-08 14:00:00+00'::timestamptz,false),
  ('Sunderland','Chelsea','2026-11-08 14:00:00+00'::timestamptz,false),
  ('Manchester United','Aston Villa','2026-11-08 16:30:00+00'::timestamptz,false)
)
insert into public.fixtures(competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=10
join public.teams home on home.name=m.home_name
join public.teams away on away.name=m.away_name
where not exists(select 1 from public.fixtures f where f.competition_week_id=w.id and f.home_team_id=home.id and f.away_team_id=away.id);

update public.fixtures f set is_gotw=false
from public.competition_weeks w where f.competition_week_id=w.id and w.number=10 and f.is_gotw;
update public.fixtures f set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id and w.number=10
  and f.home_team_id=home.id and home.name='Leeds United'
  and f.away_team_id=away.id and away.name='Tottenham Hotspur';

with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Everton','Coventry City',1.71::numeric,3.97::numeric,4.63::numeric),
  ('Leeds United','Tottenham Hotspur',2.52,3.41,2.77),
  ('Arsenal','Hull City',1.15,8.00,18.91),
  ('Fulham','Newcastle United',2.16,3.63,3.16),
  ('Nottingham Forest','Manchester City',4.63,4.10,1.69),
  ('Brighton & Hove Albion','Brentford',1.92,3.85,3.67),
  ('Crystal Palace','Liverpool',4.80,4.25,1.64),
  ('Ipswich Town','Bournemouth',3.71,3.72,1.93),
  ('Sunderland','Chelsea',3.58,3.65,2.00),
  ('Manchester United','Aston Villa',2.25,3.75,2.94)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,'2026-11-03 15:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=10
join public.fixtures f on f.competition_week_id=w.id and f.home_team_id=home.id and f.away_team_id=away.id
where not exists(select 1 from public.fixture_odds o where o.fixture_id=f.id and o.captured_at='2026-11-03 15:00:00+00');

commit;
