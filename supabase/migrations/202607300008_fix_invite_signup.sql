begin;

create or replace function public.validate_new_user_invite()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  invite_code text;
  expected_hash constant text := '5e51f7bab4b31cbc664d7a55c6b88dc9524cd5a4b8b109403baac7642d912506';
begin
  invite_code := lower(trim(coalesce(new.raw_user_meta_data ->> 'league_invite_code', '')));

  if encode(extensions.digest(invite_code, 'sha256'), 'hex') <> expected_hash then
    raise exception using
      errcode = '28000',
      message = 'Invalid league invite code';
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'league_invite_code';
  return new;
end;
$$;

drop trigger if exists validate_auth_user_invite on auth.users;
create trigger validate_auth_user_invite
  before insert on auth.users
  for each row execute procedure public.validate_new_user_invite();

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

commit;
