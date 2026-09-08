begin;

update public.season_markets
set
  status='open',
  lock_at='2026-09-12 14:00:00+00',
  description=case slug
    when 'carabao-cup-winner' then 'Back one club to win the 2026/27 Carabao Cup. Your quoted price is fixed when the market locks.'
    else 'Back one club to win the 2026/27 FA Cup. Your quoted price is fixed when the market locks.'
  end
where slug in ('carabao-cup-winner','fa-cup-winner')
  and status<>'settled';

commit;
