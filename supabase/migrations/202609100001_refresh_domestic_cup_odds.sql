begin;

-- Refresh the domestic cup outright boards on 10 September 2026. Existing
-- entries continue to reference the same option rows, so everyone can review
-- and replace their selection before the reopened Saturday deadline.
with prices(market_slug,label,sort_order,odds) as (values
  ('carabao-cup-winner','Arsenal',1,5.000::numeric),
  ('carabao-cup-winner','Chelsea',2,6.000),
  ('carabao-cup-winner','Manchester City',3,6.500),
  ('carabao-cup-winner','Liverpool',4,9.000),
  ('carabao-cup-winner','Manchester United',5,9.000),
  ('carabao-cup-winner','Tottenham Hotspur',6,11.000),
  ('carabao-cup-winner','Newcastle United',7,17.000),
  ('carabao-cup-winner','Aston Villa',8,19.000),
  ('carabao-cup-winner','Everton',9,21.000),
  ('carabao-cup-winner','Brentford',10,26.000),
  ('carabao-cup-winner','Leeds United',11,29.000),
  ('carabao-cup-winner','Bournemouth',12,34.000),
  ('carabao-cup-winner','Brighton & Hove Albion',13,34.000),
  ('carabao-cup-winner','Crystal Palace',14,34.000),
  ('carabao-cup-winner','Nottingham Forest',15,34.000),
  ('carabao-cup-winner','Fulham',16,41.000),
  ('carabao-cup-winner','Sunderland',17,41.000),
  ('carabao-cup-winner','Ipswich Town',18,51.000),
  ('carabao-cup-winner','Coventry City',19,67.000),
  ('carabao-cup-winner','West Ham United',20,67.000),
  ('carabao-cup-winner','Wolverhampton Wanderers',21,67.000),
  ('carabao-cup-winner','Hull City',22,76.000),
  ('carabao-cup-winner','Middlesbrough',23,101.000),
  ('carabao-cup-winner','Millwall',24,101.000),
  ('carabao-cup-winner','Birmingham City',25,126.000),
  ('carabao-cup-winner','Burnley',26,151.000),
  ('carabao-cup-winner','Norwich City',27,151.000),
  ('carabao-cup-winner','Sheffield United',28,151.000),
  ('carabao-cup-winner','Southampton',29,151.000),
  ('carabao-cup-winner','West Bromwich Albion',30,151.000),
  ('carabao-cup-winner','Blackburn Rovers',31,201.000),
  ('carabao-cup-winner','Charlton Athletic',32,201.000),
  ('carabao-cup-winner','Leicester City',33,201.000),
  ('carabao-cup-winner','Lincoln City',34,201.000),
  ('carabao-cup-winner','Preston North End',35,201.000),
  ('carabao-cup-winner','Stoke City',36,201.000),
  ('carabao-cup-winner','Watford',37,201.000),
  ('carabao-cup-winner','Cardiff City',38,251.000),
  ('carabao-cup-winner','Sheffield Wednesday',39,251.000),

  ('fa-cup-winner','Arsenal',1,5.750),
  ('fa-cup-winner','Manchester City',2,6.500),
  ('fa-cup-winner','Liverpool',3,8.000),
  ('fa-cup-winner','Manchester United',4,9.000),
  ('fa-cup-winner','Chelsea',5,10.000),
  ('fa-cup-winner','Tottenham Hotspur',6,15.000),
  ('fa-cup-winner','Aston Villa',7,17.000),
  ('fa-cup-winner','Newcastle United',8,23.000),
  ('fa-cup-winner','Bournemouth',9,34.000),
  ('fa-cup-winner','Brentford',10,34.000),
  ('fa-cup-winner','Brighton & Hove Albion',11,34.000),
  ('fa-cup-winner','Everton',12,34.000),
  ('fa-cup-winner','Crystal Palace',13,41.000),
  ('fa-cup-winner','Leeds United',14,41.000),
  ('fa-cup-winner','Nottingham Forest',15,41.000),
  ('fa-cup-winner','Fulham',16,51.000),
  ('fa-cup-winner','Sunderland',17,67.000),
  ('fa-cup-winner','Coventry City',18,101.000),
  ('fa-cup-winner','Ipswich Town',19,101.000),
  ('fa-cup-winner','West Ham United',20,101.000),
  ('fa-cup-winner','Wolverhampton Wanderers',21,126.000),
  ('fa-cup-winner','Birmingham City',22,151.000),
  ('fa-cup-winner','Burnley',23,151.000),
  ('fa-cup-winner','Hull City',24,151.000),
  ('fa-cup-winner','Middlesbrough',25,151.000),
  ('fa-cup-winner','Norwich City',26,151.000),
  ('fa-cup-winner','Sheffield United',27,151.000),
  ('fa-cup-winner','Southampton',28,151.000),
  ('fa-cup-winner','Wrexham',29,151.000),
  ('fa-cup-winner','Derby County',30,201.000),
  ('fa-cup-winner','Millwall',31,201.000),
  ('fa-cup-winner','Blackburn Rovers',32,251.000),
  ('fa-cup-winner','Bristol City',33,251.000),
  ('fa-cup-winner','Cardiff City',34,251.000),
  ('fa-cup-winner','Portsmouth',35,251.000),
  ('fa-cup-winner','Queens Park Rangers',36,251.000),
  ('fa-cup-winner','Stoke City',37,251.000),
  ('fa-cup-winner','Swansea City',38,251.000),
  ('fa-cup-winner','Watford',39,251.000),
  ('fa-cup-winner','West Bromwich Albion',40,251.000),
  ('fa-cup-winner','Bolton Wanderers',41,301.000),
  ('fa-cup-winner','Lincoln City',42,401.000),
  ('fa-cup-winner','Preston North End',43,401.000),
  ('fa-cup-winner','Charlton Athletic',44,501.000)
), updated as (
  update public.season_market_options option
  set sort_order=prices.sort_order,
      odds=prices.odds
  from prices
  join public.season_markets market on market.slug=prices.market_slug
  where option.market_id=market.id
    and option.label=prices.label
  returning option.id
)
select count(*) as refreshed_option_count
from updated;

update public.season_markets
set lock_at='2026-09-12 14:00:00+00',
    status=case when status='settled' then status else 'open' end
where slug in ('carabao-cup-winner','fa-cup-winner');

commit;
