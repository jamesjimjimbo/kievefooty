begin;

create or replace function public.add_continuing_featured_streak_bonuses()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.points_ledger(
    user_id,competition_week_id,type,reference_type,reference_id,amount,metadata,description
  )
  with ordered as (
    select
      p.id pick_id,s.user_id,s.competition_week_id,w.number,w.start_date,p.is_correct,
      sum(case when p.is_correct=false then 1 else 0 end) over(
        partition by s.user_id order by w.start_date,w.number,p.id
      ) loss_group
    from public.picks p
    join public.weekly_submissions s on s.id=p.submission_id
    join public.competition_weeks w on w.id=s.competition_week_id
    where p.kind='gotw' and p.settled_at is not null and w.status='settled'
  ), wins as (
    select *,row_number() over(
      partition by user_id,loss_group order by start_date,number,pick_id
    ) win_number
    from ordered
    where is_correct=true
  )
  select
    user_id,competition_week_id,'streak_bonus','pick',pick_id,10,
    jsonb_build_object('streak_length',win_number),
    'Continued featured-game winning streak'
  from wins
  where win_number>3 and win_number%3<>0
  on conflict(user_id,type,reference_type,reference_id) do nothing;
end;
$$;

revoke all on function public.add_continuing_featured_streak_bonuses() from public,anon,authenticated;
grant execute on function public.add_continuing_featured_streak_bonuses() to service_role;

create or replace function public.on_base_streak_bonus_insert()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if pg_trigger_depth()=1 then
    perform public.add_continuing_featured_streak_bonuses();
  end if;
  return new;
end;
$$;

drop trigger if exists add_continuing_featured_streak_bonuses on public.points_ledger;
create trigger add_continuing_featured_streak_bonuses
after insert on public.points_ledger
for each row
when (new.type='streak_bonus')
execute function public.on_base_streak_bonus_insert();

select public.add_continuing_featured_streak_bonuses();

commit;
