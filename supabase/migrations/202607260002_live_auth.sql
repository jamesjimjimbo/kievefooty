create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  insert into public.email_preferences(user_id) values(new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop policy if exists "read own profile" on public.profiles;
create policy "league reads profiles" on public.profiles
  for select to authenticated using(true);

grant execute on function public.submit_weekly_picks(uuid,uuid,public.outcome,numeric,uuid,public.outcome,numeric) to authenticated;

create or replace function public.get_standings(p_half public.competition_half default null)
returns table(user_id uuid, display_name text, score numeric)
language sql stable security definer set search_path=public
as $$
  select p.id, p.display_name,
    coalesce(sum(l.amount) filter (
      where
        case
          when p_half is not null then l.type in ('weekly_bet_win','weekly_bet_loss')
            and w.half = p_half
          else l.type in ('weekly_bet_win','weekly_bet_loss','challenge_win','challenge_loss')
        end
    ), 0)::numeric as score
  from profiles p
  left join points_ledger l on l.user_id=p.id
  left join competition_weeks w on w.id=l.competition_week_id
  group by p.id,p.display_name
  order by score desc,p.display_name;
$$;
grant execute on function public.get_standings(public.competition_half) to authenticated;
