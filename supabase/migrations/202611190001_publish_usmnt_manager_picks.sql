begin;

-- Publish the submitted USMNT manager picks on the Competitions page.
-- Locking the existing market reveals entries through the current RLS policy;
-- it does not replace the market or modify any saved option IDs.
update public.season_markets
set status='locked'
where slug='next-usmnt-manager'
  and status<>'settled';

commit;
