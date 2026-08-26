begin;

-- Ten-point outright markets priced from Betfair Sportsbook's 2026/27 winner
-- boards on 26 August 2026. Fractional prices are stored as decimal returns.
insert into public.season_markets(
  slug,title,description,selection_help,min_selections,max_selections,
  points_per_correct,payout_label,scoring_type,wrong_points,stake_points,
  lock_at,status,display_order
) values
  (
    'carabao-cup-winner','Carabao Cup winner',
    'Back one club to win the 2026/27 Carabao Cup. Your quoted price is fixed when the market locks.',
    'Choose one club',1,1,0,
    '10-point bet · win: 10 × odds · lose: −10',
    'odds_bet',-10,10,'2026-08-28 19:00:00+00','open',65
  ),
  (
    'fa-cup-winner','FA Cup winner',
    'Back one club to win the 2026/27 FA Cup. Your quoted price is fixed when the market locks.',
    'Choose one club',1,1,0,
    '10-point bet · win: 10 × odds · lose: −10',
    'odds_bet',-10,10,'2026-08-28 19:00:00+00','open',66
  )
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  selection_help=excluded.selection_help,
  min_selections=excluded.min_selections,
  max_selections=excluded.max_selections,
  points_per_correct=excluded.points_per_correct,
  payout_label=excluded.payout_label,
  scoring_type=excluded.scoring_type,
  wrong_points=excluded.wrong_points,
  stake_points=excluded.stake_points,
  lock_at=excluded.lock_at,
  status=case when public.season_markets.status='settled' then 'settled' else excluded.status end,
  display_order=excluded.display_order;

with prices(market_slug,label,sort_order,odds) as (values
  ('carabao-cup-winner','Arsenal',1,5.000::numeric),
  ('carabao-cup-winner','Manchester City',2,7.000),
  ('carabao-cup-winner','Liverpool',3,8.000),
  ('carabao-cup-winner','Manchester United',4,9.000),
  ('carabao-cup-winner','Chelsea',5,9.000),
  ('carabao-cup-winner','Tottenham Hotspur',6,12.000),
  ('carabao-cup-winner','Aston Villa',7,17.000),
  ('carabao-cup-winner','Newcastle United',8,19.000),
  ('carabao-cup-winner','Everton',9,23.000),
  ('carabao-cup-winner','Leeds United',10,29.000),
  ('carabao-cup-winner','Brighton & Hove Albion',11,29.000),
  ('carabao-cup-winner','Nottingham Forest',12,29.000),
  ('carabao-cup-winner','Brentford',13,29.000),
  ('carabao-cup-winner','Bournemouth',14,34.000),
  ('carabao-cup-winner','Crystal Palace',15,34.000),
  ('carabao-cup-winner','Fulham',16,34.000),
  ('carabao-cup-winner','Sunderland',17,41.000),
  ('carabao-cup-winner','West Ham United',18,67.000),
  ('carabao-cup-winner','Wolverhampton Wanderers',19,67.000),
  ('carabao-cup-winner','Coventry City',20,67.000),
  ('carabao-cup-winner','Ipswich Town',21,67.000),
  ('carabao-cup-winner','Middlesbrough',22,101.000),
  ('carabao-cup-winner','Sheffield United',23,101.000),
  ('carabao-cup-winner','Hull City',24,101.000),
  ('carabao-cup-winner','Birmingham City',25,101.000),
  ('carabao-cup-winner','Southampton',26,101.000),
  ('carabao-cup-winner','Norwich City',27,101.000),
  ('carabao-cup-winner','Burnley',28,101.000),
  ('carabao-cup-winner','West Bromwich Albion',29,176.000),
  ('carabao-cup-winner','Watford',30,176.000),
  ('carabao-cup-winner','Stoke City',31,176.000),
  ('carabao-cup-winner','Millwall',32,176.000),
  ('carabao-cup-winner','Preston North End',33,176.000),
  ('carabao-cup-winner','Lincoln City',34,201.000),
  ('carabao-cup-winner','Charlton Athletic',35,201.000),
  ('carabao-cup-winner','Cardiff City',36,201.000),
  ('carabao-cup-winner','Leicester City',37,201.000),
  ('carabao-cup-winner','Sheffield Wednesday',38,201.000),
  ('carabao-cup-winner','Blackburn Rovers',39,201.000),

  ('fa-cup-winner','Arsenal',1,5.500),
  ('fa-cup-winner','Manchester City',2,6.000),
  ('fa-cup-winner','Liverpool',3,8.000),
  ('fa-cup-winner','Manchester United',4,9.000),
  ('fa-cup-winner','Chelsea',5,10.000),
  ('fa-cup-winner','Aston Villa',6,15.000),
  ('fa-cup-winner','Tottenham Hotspur',7,15.000),
  ('fa-cup-winner','Newcastle United',8,23.000),
  ('fa-cup-winner','Brighton & Hove Albion',9,26.000),
  ('fa-cup-winner','Bournemouth',10,34.000),
  ('fa-cup-winner','Brentford',11,34.000),
  ('fa-cup-winner','Everton',12,34.000),
  ('fa-cup-winner','Fulham',13,41.000),
  ('fa-cup-winner','Leeds United',14,41.000),
  ('fa-cup-winner','Nottingham Forest',15,41.000),
  ('fa-cup-winner','Crystal Palace',16,41.000),
  ('fa-cup-winner','Sunderland',17,67.000),
  ('fa-cup-winner','Ipswich Town',18,81.000),
  ('fa-cup-winner','Coventry City',19,81.000),
  ('fa-cup-winner','Wolverhampton Wanderers',20,101.000),
  ('fa-cup-winner','Burnley',21,101.000),
  ('fa-cup-winner','West Ham United',22,101.000),
  ('fa-cup-winner','Hull City',23,101.000),
  ('fa-cup-winner','Wrexham',24,126.000),
  ('fa-cup-winner','Norwich City',25,126.000),
  ('fa-cup-winner','Middlesbrough',26,126.000),
  ('fa-cup-winner','Southampton',27,126.000),
  ('fa-cup-winner','Sheffield United',28,126.000),
  ('fa-cup-winner','Birmingham City',29,126.000),
  ('fa-cup-winner','Stoke City',30,176.000),
  ('fa-cup-winner','Bristol City',31,176.000),
  ('fa-cup-winner','Derby County',32,176.000),
  ('fa-cup-winner','West Bromwich Albion',33,176.000),
  ('fa-cup-winner','Millwall',34,176.000),
  ('fa-cup-winner','Preston North End',35,201.000),
  ('fa-cup-winner','Watford',36,201.000),
  ('fa-cup-winner','Charlton Athletic',37,201.000),
  ('fa-cup-winner','Blackburn Rovers',38,201.000),
  ('fa-cup-winner','Portsmouth',39,201.000),
  ('fa-cup-winner','Lincoln City',40,201.000),
  ('fa-cup-winner','Queens Park Rangers',41,201.000),
  ('fa-cup-winner','Swansea City',42,201.000),
  ('fa-cup-winner','Cardiff City',43,201.000),
  ('fa-cup-winner','Bolton Wanderers',44,201.000)
)
insert into public.season_market_options(market_id,label,sort_order,odds)
select m.id,p.label,p.sort_order,p.odds
from prices p
join public.season_markets m on m.slug=p.market_slug
on conflict(market_id,label) do update
set sort_order=excluded.sort_order,odds=excluded.odds;

commit;
