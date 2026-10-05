begin;

alter table public.challenges
  drop constraint if exists challenges_challenger_id_opponent_id_key;

alter table public.challenges
  drop constraint if exists challenges_week_challenger_opponent_key;

alter table public.challenges
  add constraint challenges_week_challenger_opponent_key
  unique(competition_week_id,challenger_id,opponent_id);

commit;
