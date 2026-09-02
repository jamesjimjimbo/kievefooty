begin;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  3,'London Calling','2026-09-04','2026-09-06',
  '2026-09-04 19:00:00+00','first','open',true,
  'Official 2026/27 Premier League Matchweek 3',false,'PL'
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
  ('Ipswich Town','Liverpool','2026-09-04 19:00:00+00'::timestamptz,false),
  ('Newcastle United','Bournemouth','2026-09-05 11:30:00+00'::timestamptz,false),
  ('Brentford','Sunderland','2026-09-05 14:00:00+00'::timestamptz,false),
  ('Brighton & Hove Albion','Leeds United','2026-09-05 14:00:00+00'::timestamptz,false),
  ('Fulham','Crystal Palace','2026-09-05 14:00:00+00'::timestamptz,false),
  ('Manchester City','Coventry City','2026-09-05 14:00:00+00'::timestamptz,false),
  ('Nottingham Forest','Tottenham Hotspur','2026-09-05 14:00:00+00'::timestamptz,false),
  ('Hull City','Aston Villa','2026-09-05 16:30:00+00'::timestamptz,false),
  ('Everton','Manchester United','2026-09-06 13:00:00+00'::timestamptz,false),
  ('Arsenal','Chelsea','2026-09-06 15:30:00+00'::timestamptz,true)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=3
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
where f.competition_week_id=w.id and w.number=3 and f.is_gotw;

update public.fixtures f
set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id
  and w.number=3
  and f.home_team_id=home.id and home.name='Arsenal'
  and f.away_team_id=away.id and away.name='Chelsea';

-- Best available US three-way prices from Oddschecker on 2 September 2026,
-- converted from American to decimal odds.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Ipswich Town','Liverpool',5.600::numeric,4.700::numeric,1.556::numeric),
  ('Newcastle United','Bournemouth',2.200,3.700,3.200),
  ('Brentford','Sunderland',1.617,4.100,6.000),
  ('Brighton & Hove Albion','Leeds United',1.917,3.700,4.100),
  ('Fulham','Crystal Palace',2.300,3.450,3.150),
  ('Manchester City','Coventry City',1.182,8.000,15.000),
  ('Nottingham Forest','Tottenham Hotspur',2.550,3.450,2.850),
  ('Hull City','Aston Villa',4.100,3.700,1.926),
  ('Everton','Manchester United',3.200,3.550,2.250),
  ('Arsenal','Chelsea',1.714,3.800,5.250)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,
  '2026-09-02 15:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=3
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-09-02 15:00:00+00'
);

commit;
