update public.season_markets
set lock_at='2026-09-01 19:00:00+00',
    wrong_points=0,
    payout_label='10-point bet · win: 10 × odds · lose: 0 returned'
where slug in ('carabao-cup-winner','fa-cup-winner')
  and status='open';
