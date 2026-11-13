begin;

-- Five-point prediction market: the manager of the first USMNT match after
-- Mauricio Pochettino. Prices are the published Canada Sports Betting board
-- from 11 November 2026, converted from fractional to decimal odds.
insert into public.season_markets(
  slug,title,description,selection_help,min_selections,max_selections,
  points_per_correct,payout_label,lock_at,status,display_order,
  scoring_type,wrong_points,stake_points
)
values (
  'next-usmnt-manager',
  'Who manages the next USMNT game after Poch?',
  'Pick the person in charge of the first senior USMNT match after Mauricio Pochettino. Interim managers count if they take charge of that match.',
  'Choose one candidate',
  1,1,0,
  '5-point fixed bet · return = 5 × odds',
  '2026-11-18 00:00:00+00',
  'open',65,
  'odds_bet',0,5
)
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  selection_help=excluded.selection_help,
  min_selections=excluded.min_selections,
  max_selections=excluded.max_selections,
  payout_label=excluded.payout_label,
  lock_at=excluded.lock_at,
  status=case when public.season_markets.status='settled' then 'settled' else excluded.status end,
  display_order=excluded.display_order,
  scoring_type=excluded.scoring_type,
  wrong_points=excluded.wrong_points,
  stake_points=excluded.stake_points;

with candidates(label,sort_order,odds) as (values
  ('B.J. Callaghan',1,4.00::numeric),
  ('Steve Cherundolo',2,5.00::numeric),
  ('Pellegrino Matarazzo',3,6.00::numeric),
  ('Mikey Varas',4,9.00::numeric),
  ('Thierry Henry',5,11.00::numeric),
  ('Jesse Marsch',6,15.00::numeric),
  ('Julian Nagelsmann',7,21.00::numeric),
  ('Gareth Southgate',8,21.00::numeric),
  ('Didier Deschamps',9,26.00::numeric),
  ('Eddie Howe',10,31.00::numeric),
  ('Pep Guardiola',11,41.00::numeric),
  ('Antonio Conte',12,41.00::numeric)
)
insert into public.season_market_options(market_id,label,sort_order,odds)
select market.id,candidate.label,candidate.sort_order,candidate.odds
from candidates candidate
join public.season_markets market on market.slug='next-usmnt-manager'
on conflict(market_id,label) do update set
  sort_order=excluded.sort_order,
  odds=excluded.odds;

commit;
