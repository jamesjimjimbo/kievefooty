alter table public.profiles
  add column if not exists favorite_team text,
  add column if not exists bio text check (bio is null or char_length(bio) <= 240),
  add column if not exists motto text check (motto is null or char_length(motto) <= 80),
  add column if not exists crest_url text,
  add column if not exists crest_source text check (crest_source is null or crest_source in ('uploaded','generated')),
  add column if not exists profile_completed_at timestamptz;

alter table public.weekly_submissions
  add column if not exists commentary text check (commentary is null or char_length(commentary) <= 180);

create table if not exists public.weekly_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.weekly_submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('fire','trash','eyes')),
  created_at timestamptz not null default now(),
  unique (submission_id,user_id)
);

create table if not exists public.weekly_comment_replies (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.weekly_submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 180),
  created_at timestamptz not null default now()
);

create index if not exists weekly_comment_replies_submission_date
  on public.weekly_comment_replies(submission_id,created_at);

alter table public.weekly_comment_reactions enable row level security;
alter table public.weekly_comment_replies enable row level security;

drop policy if exists "locked league reads reactions" on public.weekly_comment_reactions;
create policy "locked league reads reactions" on public.weekly_comment_reactions
  for select to authenticated using (
    exists (
      select 1 from public.weekly_submissions s
      join public.competition_weeks w on w.id=s.competition_week_id
      where s.id=submission_id and now()>=w.lock_at
    )
  );

drop policy if exists "locked league reads replies" on public.weekly_comment_replies;
create policy "locked league reads replies" on public.weekly_comment_replies
  for select to authenticated using (
    exists (
      select 1 from public.weekly_submissions s
      join public.competition_weeks w on w.id=s.competition_week_id
      where s.id=submission_id and now()>=w.lock_at
    )
  );

create or replace function public.set_weekly_comment(p_week_id uuid,p_comment text)
returns void language plpgsql security definer set search_path=public as $$
declare submission uuid; lock_time timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_comment,'')))>180 then raise exception 'Comment must be 180 characters or fewer'; end if;
  select lock_at into lock_time from public.competition_weeks where id=p_week_id;
  if lock_time is null or now()>=lock_time then raise exception 'Comments are locked'; end if;
  select id into submission from public.weekly_submissions where user_id=auth.uid() and competition_week_id=p_week_id;
  if submission is null then raise exception 'Save your picks before adding a comment'; end if;
  update public.weekly_submissions
    set commentary=nullif(trim(coalesce(p_comment,'')),'')
    where id=submission;
end $$;

create or replace function public.toggle_weekly_comment_reaction(p_submission_id uuid,p_reaction text)
returns void language plpgsql security definer set search_path=public as $$
declare existing text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reaction not in ('fire','trash','eyes') then raise exception 'Invalid reaction'; end if;
  if not exists (
    select 1 from public.weekly_submissions s
    join public.competition_weeks w on w.id=s.competition_week_id
    where s.id=p_submission_id and nullif(trim(s.commentary),'') is not null and now()>=w.lock_at
  ) then raise exception 'This comment is not available yet'; end if;
  select reaction into existing from public.weekly_comment_reactions
    where submission_id=p_submission_id and user_id=auth.uid();
  if existing=p_reaction then
    delete from public.weekly_comment_reactions where submission_id=p_submission_id and user_id=auth.uid();
  else
    insert into public.weekly_comment_reactions(submission_id,user_id,reaction)
      values(p_submission_id,auth.uid(),p_reaction)
      on conflict(submission_id,user_id) do update set reaction=excluded.reaction,created_at=now();
  end if;
end $$;

create or replace function public.add_weekly_comment_reply(p_submission_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare reply_id uuid; clean_body text:=trim(coalesce(p_body,''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(clean_body) not between 1 and 180 then raise exception 'Reply must be 1 to 180 characters'; end if;
  if not exists (
    select 1 from public.weekly_submissions s
    join public.competition_weeks w on w.id=s.competition_week_id
    where s.id=p_submission_id and nullif(trim(s.commentary),'') is not null and now()>=w.lock_at
  ) then raise exception 'This comment is not available yet'; end if;
  insert into public.weekly_comment_replies(submission_id,user_id,body)
    values(p_submission_id,auth.uid(),clean_body) returning id into reply_id;
  return reply_id;
end $$;

grant execute on function public.set_weekly_comment(uuid,text) to authenticated;
grant execute on function public.toggle_weekly_comment_reaction(uuid,text) to authenticated;
grant execute on function public.add_weekly_comment_reply(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('crests','crests',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "authenticated uploads own crest" on storage.objects;
create policy "authenticated uploads own crest" on storage.objects
  for insert to authenticated with check (bucket_id='crests' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "authenticated updates own crest" on storage.objects;
create policy "authenticated updates own crest" on storage.objects
  for update to authenticated using (bucket_id='crests' and (storage.foldername(name))[1]=auth.uid()::text)
  with check (bucket_id='crests' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "authenticated deletes own crest" on storage.objects;
create policy "authenticated deletes own crest" on storage.objects
  for delete to authenticated using (bucket_id='crests' and (storage.foldername(name))[1]=auth.uid()::text);
