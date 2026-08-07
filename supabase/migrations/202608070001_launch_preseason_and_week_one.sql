begin;

-- Normalize the original abbreviated display names before joining fixtures to
-- the official schedule. Team ids stay the same, so existing entries are safe.
with official_names(short_name,name) as (values
  ('ARS','Arsenal'),('AVL','Aston Villa'),('BOU','Bournemouth'),
  ('BRE','Brentford'),('BHA','Brighton & Hove Albion'),('CHE','Chelsea'),
  ('COV','Coventry City'),('CRY','Crystal Palace'),('EVE','Everton'),
  ('FUL','Fulham'),('HUL','Hull City'),('IPS','Ipswich Town'),
  ('LEE','Leeds United'),('LIV','Liverpool'),('MCI','Manchester City'),
  ('MUN','Manchester United'),('NEW','Newcastle United'),
  ('NFO','Nottingham Forest'),('SUN','Sunderland'),
  ('TOT','Tottenham Hotspur')
)
update public.teams t
set name=n.name
from official_names n
where t.short_name=n.short_name and t.name<>n.name;

with renamed(old_name,new_name) as (values
  ('Brighton','Brighton & Hove Albion'),
  ('Newcastle','Newcastle United'),
  ('Tottenham','Tottenham Hotspur')
)
update public.season_market_options o
set label=r.new_name
from public.season_markets m,renamed r
where o.market_id=m.id
  and m.slug in ('champion','top-four','fifth-to-seventh','relegation','manager-exit')
  and o.label=r.old_name;

-- Remove the temporary weeks used while the picking flow was being designed.
-- The guardrails below only target the exact demo labels and only when no points
-- have ever been posted against the week.
delete from public.weekly_submissions s
using public.competition_weeks w
where s.competition_week_id=w.id
  and w.label='The Run-In Begins'
  and w.start_date='2026-09-13'
  and not exists (
    select 1 from public.points_ledger l where l.competition_week_id=w.id
  );

delete from public.fixtures f
using public.competition_weeks w
where f.competition_week_id=w.id
  and w.label='The Run-In Begins'
  and w.start_date='2026-09-13'
  and not exists (
    select 1 from public.points_ledger l where l.competition_week_id=w.id
  );

delete from public.competition_weeks w
where (
  (w.label='Early Doors' and w.start_date='2026-08-22') or
  (w.label='Bank Holiday Ball' and w.start_date='2026-08-29') or
  (w.label='International Break' and w.start_date='2026-09-02') or
  (w.label='The Run-In Begins' and w.start_date='2026-09-13') or
  (w.label='Back At It' and w.start_date='2026-09-20')
)
and not exists (
  select 1 from public.points_ledger l where l.competition_week_id=w.id
)
and not exists (
  select 1 from public.weekly_submissions s where s.competition_week_id=w.id
);

-- The six markets selected before the first kickoff all close together.
update public.season_markets
set lock_at='2026-08-21 19:00:00+00',
    status='open'
where slug in (
  'champion','top-four','fifth-to-seventh','relegation','manager-exit','golden-boot'
);

update public.season_markets
set title='Golden Boot',
    description='Pick the three players who finish first, second, or third in the Premier League scoring chart. Exact order does not matter.',
    selection_help='Choose three goalscorers',
    min_selections=3,
    max_selections=3,
    points_per_correct=20,
    payout_label='20 points per correct player · 60 available',
    scoring_type='fixed_each',
    wrong_points=0,
    stake_points=0
where slug='golden-boot';

with candidates(label,sort_order) as (values
  ('Erling Haaland',1),
  ('Alexander Isak',2),
  ('Igor Thiago',3),
  ('João Pedro',4),
  ('Ollie Watkins',5),
  ('Viktor Gyökeres',6),
  ('Benjamin Šeško',7),
  ('Cole Palmer',8),
  ('Antoine Semenyo',9),
  ('Morgan Gibbs-White',10),
  ('Bukayo Saka',11),
  ('Bryan Mbeumo',12),
  ('Matheus Cunha',13),
  ('Omar Marmoush',14),
  ('Cody Gakpo',15),
  ('Liam Delap',16),
  ('Jean-Philippe Mateta',17),
  ('Dominic Solanke',18),
  ('Phil Foden',19),
  ('Florian Wirtz',20),
  ('Bruno Fernandes',21),
  ('Mohamed Salah',22),
  ('Morgan Rogers',23),
  ('Eberechi Eze',24)
)
insert into public.season_market_options(market_id,label,sort_order,odds)
select m.id,c.label,c.sort_order,null
from public.season_markets m
cross join candidates c
where m.slug='golden-boot'
on conflict(market_id,label) do update
set sort_order=excluded.sort_order,odds=null;

-- Convert the placeholder opening week into the official 2026/27 Matchweek 1.
update public.competition_weeks
set label='Opening Weekend',
    start_date='2026-08-21',
    end_date='2026-08-24',
    lock_at='2026-08-21 19:00:00+00',
    half='first',
    status='open',
    is_active_betting_week=true,
    notes='Official 2026/27 Premier League Matchweek 1',
    is_casino=false,
    competition_code='PL'
where number=1;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
select 1,'Opening Weekend','2026-08-21','2026-08-24',
  '2026-08-21 19:00:00+00','first','open',true,
  'Official 2026/27 Premier League Matchweek 1',false,'PL'
where not exists (select 1 from public.competition_weeks where number=1);

with matchweek(home_name,away_name,kickoff_at,is_gotw) as (values
  ('Arsenal','Coventry City','2026-08-21 19:00:00+00'::timestamptz,false),
  ('Hull City','Manchester United','2026-08-22 11:30:00+00'::timestamptz,false),
  ('Everton','Crystal Palace','2026-08-22 14:00:00+00'::timestamptz,false),
  ('Ipswich Town','Sunderland','2026-08-22 14:00:00+00'::timestamptz,false),
  ('Nottingham Forest','Leeds United','2026-08-22 14:00:00+00'::timestamptz,false),
  ('Brentford','Tottenham Hotspur','2026-08-22 16:30:00+00'::timestamptz,false),
  ('Brighton & Hove Albion','Aston Villa','2026-08-23 13:00:00+00'::timestamptz,false),
  ('Manchester City','Bournemouth','2026-08-23 13:00:00+00'::timestamptz,false),
  ('Newcastle United','Liverpool','2026-08-23 15:30:00+00'::timestamptz,true),
  ('Fulham','Chelsea','2026-08-24 19:00:00+00'::timestamptz,false)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,
  is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=1
join public.teams home on home.name=m.home_name
join public.teams away on away.name=m.away_name
where not exists (
  select 1 from public.fixtures f
  where f.competition_week_id=w.id
    and f.home_team_id=home.id
    and f.away_team_id=away.id
);

-- Keep the special match assignment deterministic if this migration is rerun.
update public.fixtures f
set is_gotw=false
from public.competition_weeks w
where f.competition_week_id=w.id and w.number=1 and f.is_gotw;

update public.fixtures f
set is_gotw=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id
  and w.number=1
  and f.home_team_id=home.id and home.name='Newcastle United'
  and f.away_team_id=away.id and away.name='Liverpool';

-- Decimal prices captured from Oddschecker on 7 August 2026. Picks store the
-- current price at submission time, so an admin can add a newer capture later.
with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Arsenal','Coventry City',1.182::numeric,8.000::numeric,18.000::numeric),
  ('Hull City','Manchester United',7.000,4.600,1.471),
  ('Everton','Crystal Palace',2.150,3.500,3.500),
  ('Ipswich Town','Sunderland',2.700,3.450,2.600),
  ('Nottingham Forest','Leeds United',2.250,3.500,3.200),
  ('Brentford','Tottenham Hotspur',2.375,3.650,2.880),
  ('Brighton & Hove Albion','Aston Villa',2.300,3.750,2.900),
  ('Manchester City','Bournemouth',1.455,5.000,6.500),
  ('Newcastle United','Liverpool',2.900,4.000,2.260),
  ('Fulham','Chelsea',3.250,3.750,2.250)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,
  '2026-08-07 12:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=1
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-08-07 12:00:00+00'
);

commit;
