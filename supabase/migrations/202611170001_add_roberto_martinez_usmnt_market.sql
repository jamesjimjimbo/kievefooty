begin;

-- Add Roberto Martinez to the existing permanent-manager market without
-- replacing the market or touching any submitted entry option IDs.
-- Keep the remaining candidates in their existing order relative to one
-- another while making room for Martinez on the published board.
update public.season_market_options option
set sort_order=case option.label
  when 'Julian Nagelsmann' then 8
  when 'Gareth Southgate' then 9
  when 'Didier Deschamps' then 10
  when 'Eddie Howe' then 11
  when 'Pep Guardiola' then 12
  when 'Antonio Conte' then 13
  else option.sort_order
end
from public.season_markets market
where option.market_id=market.id
  and market.slug='next-usmnt-manager'
  and option.label in (
    'Julian Nagelsmann','Gareth Southgate','Didier Deschamps',
    'Eddie Howe','Pep Guardiola','Antonio Conte'
  );

insert into public.season_market_options(market_id,label,sort_order,odds)
select id,'Roberto Martinez',7,15.00::numeric
from public.season_markets
where slug='next-usmnt-manager'
on conflict(market_id,label) do update set
  sort_order=excluded.sort_order,
  odds=excluded.odds;

commit;
