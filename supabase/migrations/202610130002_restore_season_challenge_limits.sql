begin;

create or replace function public.enforce_challenge() returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare lock_time timestamptz;
begin
  select lock_at into lock_time
  from public.competition_weeks
  where id=new.competition_week_id;

  if new.challenger_id<>auth.uid() or now()>=lock_time then
    raise exception 'Challenge is invalid or locked';
  end if;

  if exists (
    select 1
    from public.challenges existing
    where existing.challenger_id=new.challenger_id
      and existing.opponent_id=new.opponent_id
  ) then
    raise exception 'You have already challenged this player this season';
  end if;

  return new;
end
$$;

-- Restore the original database-level season constraint where historical data
-- contains no repeated directed matchups. If repeats already exist, preserve
-- that history; the trigger above still prevents any new repeat challenge.
do $$
begin
  if not exists (
    select 1
    from public.challenges
    group by challenger_id,opponent_id
    having count(*)>1
  ) then
    alter table public.challenges
      drop constraint if exists challenges_week_challenger_opponent_key;

    alter table public.challenges
      drop constraint if exists challenges_challenger_id_opponent_id_key;

    alter table public.challenges
      add constraint challenges_challenger_id_opponent_id_key
      unique(challenger_id,opponent_id);
  end if;
end
$$;

commit;
