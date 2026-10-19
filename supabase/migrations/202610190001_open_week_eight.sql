begin;

update public.competition_weeks
set is_active_betting_week=false
where number<>8 and is_active_betting_week;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  8,'Seagulls at Anfield','2026-10-23','2026-10-25',
  '2026-10-23 19:00:00+00','first','open',true,
  'Premier League fixtures for 23-25 October 2026',false,'PL'
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
  ('Ipswich Town','Nottingham Forest','2026-10-23 19:00:00+00'::timestamptz,false),
  ('Aston Villa','Manchester City','2026-10-24 11:30:00+00'::timestamptz,false),
  ('Arsenal','Everton','2026-10-24 14:00:00+00'::timestamptz,false),
  ('Coventry City','Fulham','2026-10-24 14:00:00+00'::timestamptz,false),
  ('Chelsea','Tottenham Hotspur','2026-10-24 16:30:00+00'::timestamptz,false),
  ('Crystal Palace','Newcastle United','2026-10-25 14:00:00+00'::timestamptz,false),
  ('Hull City','Brentford','2026-10-25 14:00:00+00'::timestamptz,false),
  ('Liverpool','Brighton & Hove Albion','2026-10-25 14:00:00+00'::timestamptz,true),
  ('Manchester United','Bournemouth','2026-10-25 14:00:00+00'::timestamptz,false),
  ('Sunderland','Leeds United','2026-10-25 16:30:00+00'::timestamptz,false)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=8
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
where f.competition_week_id=w.id and w.number=8 and f.is_gotw;

update public.fixtures f
set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id
  and w.number=8
  and f.home_team_id=home.id and home.name='Liverpool'
  and f.away_team_id=away.id and away.name='Brighton & Hove Albion';

-- Best available three-way decimal prices captured on 19 October 2026.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Ipswich Town','Nottingham Forest',3.20::numeric,3.60::numeric,2.30::numeric),
  ('Aston Villa','Manchester City',4.50,4.20,1.73),
  ('Arsenal','Everton',1.40,4.80,8.50),
  ('Coventry City','Fulham',2.90,3.60,2.35),
  ('Chelsea','Tottenham Hotspur',1.80,4.10,4.30),
  ('Crystal Palace','Newcastle United',2.90,3.75,2.40),
  ('Hull City','Brentford',4.40,4.00,1.75),
  ('Liverpool','Brighton & Hove Albion',2.10,4.00,3.30),
  ('Manchester United','Bournemouth',1.90,3.90,3.90),
  ('Sunderland','Leeds United',2.78,3.47,2.72)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,
  '2026-10-19 18:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=8
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-10-19 18:00:00+00'
);

commit;
