begin;

-- Refresh the preseason shortlist from the current 2026/27 top-goalscorer
-- market, then verify every candidate against the official FPL player pool.
-- Existing option ids are preserved for candidates already in the market.
with candidates(label,sort_order) as (values
  ('Erling Haaland',1),
  ('Alexander Isak',2),
  ('Igor Thiago',3),
  ('Ollie Watkins',4),
  ('João Pedro',5),
  ('Viktor Gyökeres',6),
  ('Benjamin Šeško',7),
  ('Cole Palmer',8),
  ('Kai Havertz',9),
  ('Dominic Solanke',10),
  ('Antoine Semenyo',11),
  ('Cody Gakpo',12),
  ('Yoane Wissa',13),
  ('Jean-Philippe Mateta',14),
  ('Dominic Calvert-Lewin',15),
  ('Bryan Mbeumo',16),
  ('Junior Kroupi',17),
  ('Hugo Ekitiké',18),
  ('Nick Woltemade',19),
  ('Richarlison',20),
  ('Bruno Fernandes',21),
  ('Matheus Cunha',22),
  ('William Osula',23),
  ('Danny Welbeck',24),
  ('Omar Marmoush',25),
  ('Evanilson',26),
  ('Chris Wood',27),
  ('Brian Brobbey',28),
  ('Jérémy Doku',29),
  ('Dango Ouattara',30),
  ('Rayan',31),
  ('Ismaïla Sarr',32),
  ('Jørgen Strand Larsen',33),
  ('Rodrigo Muniz',34),
  ('Beto',35),
  ('Thierno Barry',36),
  ('Florian Wirtz',37),
  ('Rayan Cherki',38),
  ('Kevin Schade',39),
  ('Igor Jesus',40),
  ('Jaidon Anthony',41),
  ('Justin Kluivert',42),
  ('Ellis Simms',43),
  ('Haji Wright',44),
  ('George Hirst',45),
  ('Emersonn',46),
  ('Oli McBurnie',47),
  ('Bukayo Saka',48),
  ('Morgan Gibbs-White',49),
  ('Phil Foden',50),
  ('Morgan Rogers',51),
  ('Eberechi Eze',52),
  ('Liam Delap',53)
)
insert into public.season_market_options(market_id,label,sort_order,odds)
select m.id,c.label,c.sort_order,null
from public.season_markets m
cross join candidates c
where m.slug='golden-boot'
on conflict(market_id,label) do update
set sort_order=excluded.sort_order,odds=null;

-- Any saved entry containing a now-ineligible player must be chosen again;
-- otherwise it could appear complete with an invisible third selection.
with candidates(label) as (values
  ('Erling Haaland'),('Alexander Isak'),('Igor Thiago'),('Ollie Watkins'),
  ('João Pedro'),('Viktor Gyökeres'),('Benjamin Šeško'),('Cole Palmer'),
  ('Kai Havertz'),('Dominic Solanke'),('Antoine Semenyo'),('Cody Gakpo'),
  ('Yoane Wissa'),('Jean-Philippe Mateta'),('Dominic Calvert-Lewin'),
  ('Bryan Mbeumo'),('Junior Kroupi'),('Hugo Ekitiké'),('Nick Woltemade'),
  ('Richarlison'),('Bruno Fernandes'),('Matheus Cunha'),('William Osula'),
  ('Danny Welbeck'),('Omar Marmoush'),('Evanilson'),('Chris Wood'),
  ('Brian Brobbey'),('Jérémy Doku'),('Dango Ouattara'),('Rayan'),
  ('Ismaïla Sarr'),('Jørgen Strand Larsen'),('Rodrigo Muniz'),('Beto'),
  ('Thierno Barry'),('Florian Wirtz'),('Rayan Cherki'),('Kevin Schade'),
  ('Igor Jesus'),('Jaidon Anthony'),('Justin Kluivert'),('Ellis Simms'),
  ('Haji Wright'),('George Hirst'),('Emersonn'),('Oli McBurnie'),
  ('Bukayo Saka'),('Morgan Gibbs-White'),('Phil Foden'),('Morgan Rogers'),
  ('Eberechi Eze'),('Liam Delap')
), invalid_options as (
  select o.id
  from public.season_market_options o
  join public.season_markets m on m.id=o.market_id
  where m.slug='golden-boot'
    and not exists(select 1 from candidates c where c.label=o.label)
)
delete from public.season_market_entries e
where exists(select 1 from invalid_options i where i.id=any(e.option_ids));

with candidates(label) as (values
  ('Erling Haaland'),('Alexander Isak'),('Igor Thiago'),('Ollie Watkins'),
  ('João Pedro'),('Viktor Gyökeres'),('Benjamin Šeško'),('Cole Palmer'),
  ('Kai Havertz'),('Dominic Solanke'),('Antoine Semenyo'),('Cody Gakpo'),
  ('Yoane Wissa'),('Jean-Philippe Mateta'),('Dominic Calvert-Lewin'),
  ('Bryan Mbeumo'),('Junior Kroupi'),('Hugo Ekitiké'),('Nick Woltemade'),
  ('Richarlison'),('Bruno Fernandes'),('Matheus Cunha'),('William Osula'),
  ('Danny Welbeck'),('Omar Marmoush'),('Evanilson'),('Chris Wood'),
  ('Brian Brobbey'),('Jérémy Doku'),('Dango Ouattara'),('Rayan'),
  ('Ismaïla Sarr'),('Jørgen Strand Larsen'),('Rodrigo Muniz'),('Beto'),
  ('Thierno Barry'),('Florian Wirtz'),('Rayan Cherki'),('Kevin Schade'),
  ('Igor Jesus'),('Jaidon Anthony'),('Justin Kluivert'),('Ellis Simms'),
  ('Haji Wright'),('George Hirst'),('Emersonn'),('Oli McBurnie'),
  ('Bukayo Saka'),('Morgan Gibbs-White'),('Phil Foden'),('Morgan Rogers'),
  ('Eberechi Eze'),('Liam Delap')
)
delete from public.season_market_options o
using public.season_markets m
where o.market_id=m.id
  and m.slug='golden-boot'
  and not exists(select 1 from candidates c where c.label=o.label);

commit;
