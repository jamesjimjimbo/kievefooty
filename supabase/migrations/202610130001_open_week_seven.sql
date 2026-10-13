begin;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  7,'Cottagers vs Tigers','2026-10-17','2026-10-19',
  '2026-10-17 11:30:00+00','first','open',true,
  'Premier League fixtures for 17-19 October 2026',false,'PL'
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
  ('Everton','Chelsea','2026-10-17 11:30:00+00'::timestamptz,false),
  ('Brentford','Liverpool','2026-10-17 14:00:00+00'::timestamptz,false),
  ('Fulham','Hull City','2026-10-17 14:00:00+00'::timestamptz,true),
  ('Manchester City','Ipswich Town','2026-10-17 14:00:00+00'::timestamptz,false),
  ('Newcastle United','Aston Villa','2026-10-17 16:30:00+00'::timestamptz,false),
  ('Bournemouth','Sunderland','2026-10-18 13:00:00+00'::timestamptz,false),
  ('Brighton & Hove Albion','Crystal Palace','2026-10-18 13:00:00+00'::timestamptz,false),
  ('Leeds United','Manchester United','2026-10-18 13:00:00+00'::timestamptz,false),
  ('Nottingham Forest','Arsenal','2026-10-18 15:30:00+00'::timestamptz,false),
  ('Tottenham Hotspur','Coventry City','2026-10-19 19:00:00+00'::timestamptz,false)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=7
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
where f.competition_week_id=w.id and w.number=7 and f.is_gotw;

update public.fixtures f
set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id
  and w.number=7
  and f.home_team_id=home.id and home.name='Fulham'
  and f.away_team_id=away.id and away.name='Hull City';

-- Best available three-way decimal prices captured on 13 October 2026.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Everton','Chelsea',3.15::numeric,3.78::numeric,2.17::numeric),
  ('Brentford','Liverpool',2.44,3.64,2.79),
  ('Fulham','Hull City',1.69,4.00,5.05),
  ('Manchester City','Ipswich Town',1.24,6.90,11.00),
  ('Newcastle United','Aston Villa',2.20,3.75,3.10),
  ('Bournemouth','Sunderland',2.05,3.65,3.75),
  ('Brighton & Hove Albion','Crystal Palace',1.59,4.45,5.30),
  ('Leeds United','Manchester United',2.55,3.64,2.66),
  ('Nottingham Forest','Arsenal',5.95,3.88,1.62),
  ('Tottenham Hotspur','Coventry City',1.50,4.60,6.30)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,
  '2026-10-13 22:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=7
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-10-13 22:00:00+00'
);

commit;
