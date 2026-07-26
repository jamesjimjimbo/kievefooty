insert into public.teams(name,short_name) values
('Arsenal','ARS'),('Liverpool','LIV'),('Brighton','BHA'),('Chelsea','CHE'),
('Everton','EVE'),('Tottenham','TOT'),('Manchester United','MUN'),('Newcastle','NEW')
on conflict do nothing;
insert into public.competition_weeks(number,label,start_date,end_date,lock_at,half,status,is_active_betting_week,notes)
values
(1,'Opening Weekend','2026-08-15','2026-08-18','2026-08-15 10:00:00+00','first','settled',true,'Opening weekend'),
(2,'Early Doors','2026-08-22','2026-08-25','2026-08-22 10:00:00+00','first','settled',true,null),
(3,'Bank Holiday Ball','2026-08-29','2026-09-01','2026-08-29 10:00:00+00','first','settled',true,null),
(null,'International Break','2026-09-02','2026-09-12',null,null,'break',false,'No competition fixtures'),
(4,'The Run-In Begins','2026-09-13','2026-09-15','2026-09-13 14:00:00+00','first','open',true,'Current demo week'),
(5,'Back At It','2026-09-20','2026-09-22','2026-09-20 14:00:00+00','first','draft',true,null)
on conflict(number) do nothing;
-- Profiles reference auth.users and are intentionally not faked here.
with w as (select id from public.competition_weeks where number=4),
t as (select name,id from public.teams)
insert into public.fixtures(competition_week_id,home_team_id,away_team_id,kickoff_at,is_gotw)
select w.id,h.id,a.id,x.kickoff,x.gotw from w cross join
(values
 ('Arsenal','Liverpool','2026-09-13 16:30:00+00'::timestamptz,true),
 ('Brighton','Chelsea','2026-09-13 18:00:00+00'::timestamptz,false),
 ('Everton','Tottenham','2026-09-13 20:30:00+00'::timestamptz,false),
 ('Manchester United','Newcastle','2026-09-14 14:00:00+00'::timestamptz,false)
) x(home,away,kickoff,gotw)
join t h on h.name=x.home join t a on a.name=x.away;
insert into public.fixture_odds(fixture_id,home,draw,away)
select f.id,
case h.name when 'Arsenal' then 2.10 when 'Brighton' then 3.10 when 'Everton' then 2.90 else 2.45 end,
case h.name when 'Arsenal' then 3.40 when 'Brighton' then 3.35 when 'Everton' then 3.50 else 3.30 end,
case h.name when 'Arsenal' then 3.25 when 'Brighton' then 2.20 when 'Everton' then 2.35 else 2.75 end
from public.fixtures f join public.teams h on h.id=f.home_team_id
join public.competition_weeks w on w.id=f.competition_week_id where w.number=4;
-- Profiles reference auth.users and are intentionally not faked here. Once users
-- exist, the admin UI can create adjustments and challenges against those IDs.
