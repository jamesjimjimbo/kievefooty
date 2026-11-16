begin;

update public.competition_weeks
set is_active_betting_week=false
where number<>11 and is_active_betting_week;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  11,'Poch at Anfield','2026-11-21','2026-11-23',
  '2026-11-21 12:30:00+00','first','open',true,
  'Premier League fixtures for 21-23 November 2026',false,'PL'
)
on conflict(number) do update set
  label=excluded.label,start_date=excluded.start_date,end_date=excluded.end_date,
  lock_at=excluded.lock_at,half=excluded.half,
  status=case when public.competition_weeks.status='settled' then 'settled'::public.week_status else excluded.status end,
  is_active_betting_week=excluded.is_active_betting_week,notes=excluded.notes,
  is_casino=excluded.is_casino,competition_code=excluded.competition_code;

with matchweek(home_name,away_name,kickoff_at,is_gotw) as (values
  ('Manchester City','Fulham','2026-11-21 12:30:00+00'::timestamptz,false),
  ('Aston Villa','Sunderland','2026-11-21 15:00:00+00'::timestamptz,false),
  ('Bournemouth','Nottingham Forest','2026-11-21 15:00:00+00'::timestamptz,false),
  ('Chelsea','Leeds United','2026-11-21 15:00:00+00'::timestamptz,false),
  ('Coventry City','Crystal Palace','2026-11-21 15:00:00+00'::timestamptz,false),
  ('Tottenham Hotspur','Ipswich Town','2026-11-21 15:00:00+00'::timestamptz,false),
  ('Newcastle United','Arsenal','2026-11-21 17:30:00+00'::timestamptz,false),
  ('Hull City','Brighton & Hove Albion','2026-11-22 14:00:00+00'::timestamptz,false),
  ('Liverpool','Manchester United','2026-11-22 16:30:00+00'::timestamptz,true),
  ('Brentford','Everton','2026-11-23 20:00:00+00'::timestamptz,false)
)
insert into public.fixtures(competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=11
join public.teams home on home.name=m.home_name
join public.teams away on away.name=m.away_name
where not exists(select 1 from public.fixtures f where f.competition_week_id=w.id and f.home_team_id=home.id and f.away_team_id=away.id);

update public.fixtures f set is_gotw=false
from public.competition_weeks w where f.competition_week_id=w.id and w.number=11 and f.is_gotw;
update public.fixtures f set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id and w.number=11
  and f.home_team_id=home.id and home.name='Liverpool'
  and f.away_team_id=away.id and away.name='Manchester United';

with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Manchester City','Fulham',1.47::numeric,5.33::numeric,7.60::numeric),
  ('Aston Villa','Sunderland',1.84,4.16,4.80),
  ('Bournemouth','Nottingham Forest',2.08,3.78,3.90),
  ('Chelsea','Leeds United',1.96,4.01,4.26),
  ('Coventry City','Crystal Palace',2.56,3.80,2.91),
  ('Tottenham Hotspur','Ipswich Town',1.60,4.62,6.00),
  ('Newcastle United','Arsenal',5.90,4.41,1.63),
  ('Hull City','Brighton & Hove Albion',6.80,4.62,1.57),
  ('Liverpool','Manchester United',1.81,4.30,4.45),
  ('Brentford','Everton',2.20,3.84,3.60)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,'2026-11-16 18:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=11
join public.fixtures f on f.competition_week_id=w.id and f.home_team_id=home.id and f.away_team_id=away.id
where not exists(select 1 from public.fixture_odds o where o.fixture_id=f.id and o.captured_at='2026-11-16 18:00:00+00');

commit;
