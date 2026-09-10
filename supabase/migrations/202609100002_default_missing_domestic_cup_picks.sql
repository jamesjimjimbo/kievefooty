begin;

create or replace function public.auto_submit_missing_domestic_cup_entries()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  created_count integer:=0;
begin
  with eligible_markets as (
    select market.id as market_id,option.id as arsenal_option_id
    from public.season_markets market
    join public.season_market_options option
      on option.market_id=market.id and option.label='Arsenal'
    where market.slug in ('carabao-cup-winner','fa-cup-winner')
      and market.status='open'
      and now()>=market.lock_at
  ), inserted as (
    insert into public.season_market_entries(user_id,market_id,option_ids,submitted_at)
    select profile.id,market.market_id,array[market.arsenal_option_id],now()
    from public.profiles profile
    cross join eligible_markets market
    where not exists (
      select 1
      from public.season_market_entries entry
      where entry.user_id=profile.id and entry.market_id=market.market_id
    )
    on conflict(user_id,market_id) do nothing
    returning id
  )
  select count(*) into created_count from inserted;

  update public.season_markets
  set status='locked'
  where slug in ('carabao-cup-winner','fa-cup-winner')
    and status='open'
    and now()>=lock_at;

  return jsonb_build_object('created',created_count);
end;
$$;

revoke all on function public.auto_submit_missing_domestic_cup_entries() from public;
grant execute on function public.auto_submit_missing_domestic_cup_entries() to service_role;

commit;
