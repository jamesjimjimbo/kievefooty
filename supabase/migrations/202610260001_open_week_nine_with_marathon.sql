begin;

update public.competition_weeks
set is_active_betting_week=false
where number<>9 and is_active_betting_week;

insert into public.competition_weeks(
  number,label,start_date,end_date,lock_at,half,status,
  is_active_betting_week,notes,is_casino,competition_code
)
values (
  9,'Anfield Heavyweights','2026-10-31','2026-11-02',
  '2026-10-31 12:30:00+00','first','open',true,
  'Premier League fixtures for 31 October-2 November 2026, plus the marathon over/under',false,'PL'
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
  ('Chelsea','Manchester United','2026-10-31 12:30:00+00'::timestamptz,false),
  ('Bournemouth','Leeds United','2026-10-31 15:00:00+00'::timestamptz,false),
  ('Brentford','Nottingham Forest','2026-10-31 15:00:00+00'::timestamptz,false),
  ('Coventry City','Sunderland','2026-10-31 15:00:00+00'::timestamptz,false),
  ('Hull City','Ipswich Town','2026-10-31 15:00:00+00'::timestamptz,false),
  ('Manchester City','Brighton & Hove Albion','2026-10-31 15:00:00+00'::timestamptz,false),
  ('Tottenham Hotspur','Crystal Palace','2026-10-31 17:30:00+00'::timestamptz,false),
  ('Aston Villa','Fulham','2026-10-31 20:00:00+00'::timestamptz,false),
  ('Liverpool','Arsenal','2026-11-01 16:30:00+00'::timestamptz,true),
  ('Newcastle United','Everton','2026-11-02 20:00:00+00'::timestamptz,false)
)
insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,is_gotw
)
select w.id,home.id,away.id,m.kickoff_at,'scheduled',true,m.is_gotw
from matchweek m
join public.competition_weeks w on w.number=9
join public.teams home on home.name=m.home_name
join public.teams away on away.name=m.away_name
where not exists (
  select 1 from public.fixtures f
  where f.competition_week_id=w.id
    and f.home_team_id=home.id and f.away_team_id=away.id
);

update public.fixtures f set is_gotw=false
from public.competition_weeks w
where f.competition_week_id=w.id and w.number=9 and f.is_gotw;

update public.fixtures f
set is_gotw=true,is_eligible=true
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id and w.number=9
  and f.home_team_id=home.id and home.name='Liverpool'
  and f.away_team_id=away.id and away.name='Arsenal';

with prices(home_name,away_name,home_price,draw_price,away_price) as (values
  ('Chelsea','Manchester United',1.98::numeric,4.10::numeric,4.20::numeric),
  ('Bournemouth','Leeds United',2.24,3.60,3.60),
  ('Brentford','Nottingham Forest',2.07,3.88,4.00),
  ('Coventry City','Sunderland',3.05,3.54,2.54),
  ('Hull City','Ipswich Town',2.72,3.60,2.74),
  ('Manchester City','Brighton & Hove Albion',1.74,4.80,4.70),
  ('Tottenham Hotspur','Crystal Palace',1.61,4.80,6.20),
  ('Aston Villa','Fulham',2.00,3.88,4.10),
  ('Liverpool','Arsenal',3.33,3.80,2.42),
  ('Newcastle United','Everton',2.36,3.78,3.30)
)
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,p.home_price,p.draw_price,p.away_price,'2026-10-26 18:00:00+00',false
from prices p
join public.teams home on home.name=p.home_name
join public.teams away on away.name=p.away_name
join public.competition_weeks w on w.number=9
join public.fixtures f on f.competition_week_id=w.id
  and f.home_team_id=home.id and f.away_team_id=away.id
where not exists (
  select 1 from public.fixture_odds o
  where o.fixture_id=f.id and o.captured_at='2026-10-26 18:00:00+00'
);

insert into public.teams(name,short_name) values
  ('Under 3:55','U355'),
  ('Over 3:55','O355')
on conflict(name) do update set short_name=excluded.short_name;

insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,
  is_gotw,is_manager_special,provider_competition_code
)
select w.id,under_team.id,over_team.id,'2026-11-01 15:00:00+00','scheduled',true,false,true,'MARATHON'
from public.competition_weeks w
join public.teams under_team on under_team.name='Under 3:55'
join public.teams over_team on over_team.name='Over 3:55'
where w.number=9
  and not exists(
    select 1 from public.fixtures f
    where f.competition_week_id=w.id
      and f.home_team_id=under_team.id and f.away_team_id=over_team.id
  );

update public.fixtures f set is_manager_special=false
from public.competition_weeks w
where f.competition_week_id=w.id and w.number=9 and f.is_manager_special;

update public.fixtures f
set is_manager_special=true,is_eligible=true,provider_competition_code='MARATHON',
    kickoff_at='2026-11-01 15:00:00+00'
from public.competition_weeks w,public.teams under_team,public.teams over_team
where f.competition_week_id=w.id and w.number=9
  and f.home_team_id=under_team.id and under_team.name='Under 3:55'
  and f.away_team_id=over_team.id and over_team.name='Over 3:55';

insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,2.00,1.00,2.00,'2026-10-26 18:00:00+00',false
from public.fixtures f
join public.competition_weeks w on w.id=f.competition_week_id and w.number=9
where f.is_manager_special
  and not exists(
    select 1 from public.fixture_odds o
    where o.fixture_id=f.id and o.captured_at='2026-10-26 18:00:00+00'
  );

alter table public.picks drop constraint if exists picks_stake_check;
alter table public.picks add constraint picks_stake_check check(stake between 1 and 10);

-- The shared submission function creates every manager special at five points.
-- Upgrade this named market to ten and reject the unused draw outcome.
create or replace function public.enforce_marathon_special_pick()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.kind='special' and exists(
    select 1
    from public.fixtures f
    join public.teams home on home.id=f.home_team_id
    join public.teams away on away.id=f.away_team_id
    where f.id=new.fixture_id
      and home.name='Under 3:55' and away.name='Over 3:55'
  ) then
    -- The lock-time fallback tries to add a draw for missing specials. This is
    -- a two-way participation market, so quietly omit that fallback pick.
    if new.selected_outcome='draw' then return null; end if;
    new.stake:=10;
  end if;
  return new;
end
$$;

drop trigger if exists enforce_marathon_special_pick on public.picks;
create trigger enforce_marathon_special_pick
before insert or update of fixture_id,kind,selected_outcome,stake
on public.picks
for each row execute function public.enforce_marathon_special_pick();

-- Keep the explicit lock pinned to the first Premier League kickoff. The
-- general fixture trigger will preserve this because the marathon starts later.
update public.competition_weeks
set lock_at='2026-10-31 12:30:00+00',status='open'
where number=9;

commit;
