begin;

update public.season_markets
set title='Who will be the next permanent USMNT manager?',
    description='Pick the next permanent head coach appointed by U.S. Soccer after Mauricio Pochettino. Caretakers and interim managers do not count.',
    selection_help='Choose one permanent-manager candidate'
where slug='next-usmnt-manager';

commit;
