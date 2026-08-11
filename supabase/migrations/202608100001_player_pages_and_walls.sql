begin;

create table if not exists public.player_wall_posts (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null constraint player_wall_posts_target_user_id_fkey references public.profiles(id) on delete cascade,
  author_user_id uuid not null constraint player_wall_posts_author_user_id_fkey references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 180),
  created_at timestamptz not null default now()
);

create index if not exists player_wall_posts_target_created_idx
  on public.player_wall_posts(target_user_id,created_at desc);

alter table public.player_wall_posts enable row level security;

drop policy if exists "league reads player walls" on public.player_wall_posts;
create policy "league reads player walls" on public.player_wall_posts
  for select to authenticated using (true);

drop policy if exists "members post as themselves" on public.player_wall_posts;
create policy "members post as themselves" on public.player_wall_posts
  for insert to authenticated with check (author_user_id=auth.uid());

drop policy if exists "authors and wall owners delete posts" on public.player_wall_posts;
create policy "authors and wall owners delete posts" on public.player_wall_posts
  for delete to authenticated using (
    author_user_id=auth.uid()
    or target_user_id=auth.uid()
    or exists(select 1 from public.profiles where id=auth.uid() and is_admin)
  );

grant select,insert,delete on public.player_wall_posts to authenticated;

commit;
