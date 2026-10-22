begin;

insert into public.teams(name,short_name) values
  ('Barcelona','BAR'),
  ('Real Madrid','RMA')
on conflict(name) do update set short_name=excluded.short_name;

insert into public.fixtures(
  competition_week_id,home_team_id,away_team_id,kickoff_at,status,is_eligible,
  is_gotw,is_manager_special,provider_competition_code
)
select w.id,home.id,away.id,'2026-10-25 20:00:00+00','scheduled',true,false,true,'PD'
from public.competition_weeks w
join public.teams home on home.name='Barcelona'
join public.teams away on away.name='Real Madrid'
where w.number=8
  and not exists(
    select 1 from public.fixtures f
    where f.competition_week_id=w.id
      and f.home_team_id=home.id and f.away_team_id=away.id
  );

update public.fixtures f set is_manager_special=false
from public.competition_weeks w
where f.competition_week_id=w.id and w.number=8 and f.is_manager_special;

update public.fixtures f
set is_manager_special=true,is_eligible=true,provider_competition_code='PD',
    kickoff_at='2026-10-25 20:00:00+00'
from public.competition_weeks w,public.teams home,public.teams away
where f.competition_week_id=w.id and w.number=8
  and f.home_team_id=home.id and home.name='Barcelona'
  and f.away_team_id=away.id and away.name='Real Madrid';

-- Best currently available 1X2 prices captured 22 October 2026.
insert into public.fixture_odds(fixture_id,home,draw,away,captured_at,is_closing)
select f.id,1.61,5.60,4.14,'2026-10-22 18:00:00+00',false
from public.fixtures f
join public.competition_weeks w on w.id=f.competition_week_id and w.number=8
where f.is_manager_special
  and not exists(
    select 1 from public.fixture_odds o
    where o.fixture_id=f.id and o.captured_at='2026-10-22 18:00:00+00'
  );

commit;
