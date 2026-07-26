create extension if not exists pgcrypto;
create type public.competition_half as enum ('first','second');
create type public.week_status as enum ('draft','open','locked','settled','break');
create type public.fixture_status as enum ('scheduled','live','final','postponed');
create type public.pick_source as enum ('manual','auto');
create type public.outcome as enum ('home','draw','away');
create type public.ledger_type as enum ('weekly_credit','weekly_bet_win','weekly_bet_loss','challenge_win','challenge_loss','streak_bonus','admin_adjustment','holiday_casino_win','holiday_casino_loss','final_casino_win','final_casino_loss','manager_sack','manager_survival','season_prediction','golden_boot','january_mover','ucl_final');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  email text not null, is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.email_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  new_week boolean not null default true, deadline_reminder boolean not null default true,
  challenge_notification boolean not null default true, weekly_results boolean not null default false
);
create table public.teams (
  id uuid primary key default gen_random_uuid(), name text not null unique, short_name text not null unique
);
create table public.competition_weeks (
  id uuid primary key default gen_random_uuid(), number integer unique, label text not null,
  start_date date not null, end_date date not null, lock_at timestamptz,
  half public.competition_half, status public.week_status not null default 'draft',
  is_active_betting_week boolean not null default true, notes text,
  is_casino boolean not null default false,
  check (end_date >= start_date),
  check ((is_active_betting_week and lock_at is not null and half is not null) or not is_active_betting_week)
);
create table public.fixtures (
  id uuid primary key default gen_random_uuid(), competition_week_id uuid not null references public.competition_weeks(id),
  home_team_id uuid not null references public.teams(id), away_team_id uuid not null references public.teams(id),
  kickoff_at timestamptz not null, status public.fixture_status not null default 'scheduled',
  home_score integer, away_score integer, is_eligible boolean not null default true,
  is_gotw boolean not null default false, check (home_team_id <> away_team_id)
);
create unique index one_gotw_per_week on public.fixtures(competition_week_id) where is_gotw;
create table public.fixture_odds (
  id uuid primary key default gen_random_uuid(), fixture_id uuid not null references public.fixtures(id) on delete cascade,
  home numeric(7,3) not null check(home>=1), draw numeric(7,3) not null check(draw>=1), away numeric(7,3) not null check(away>=1),
  captured_at timestamptz not null default now(), is_closing boolean not null default false
);
create table public.weekly_submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  competition_week_id uuid not null references public.competition_weeks(id), source public.pick_source not null default 'manual',
  submitted_at timestamptz not null default now(), unique(user_id,competition_week_id)
);
create table public.picks (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.weekly_submissions(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id), kind text not null check(kind in ('gotw','own')),
  selected_outcome public.outcome not null, stake numeric(10,2) not null check(stake between 1 and 9), odds numeric(7,3) not null check(odds>=1),
  settled_at timestamptz, is_correct boolean, unique(submission_id,kind)
);
create table public.challenges (
  id uuid primary key default gen_random_uuid(), competition_week_id uuid not null references public.competition_weeks(id),
  challenger_id uuid not null references public.profiles(id), opponent_id uuid not null references public.profiles(id),
  settled_at timestamptz, challenger_weekly_net numeric(10,2), opponent_weekly_net numeric(10,2),
  created_at timestamptz not null default now(), check(challenger_id<>opponent_id),
  unique(challenger_id,opponent_id)
);
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  competition_week_id uuid references public.competition_weeks(id), type public.ledger_type not null,
  reference_type text not null, reference_id uuid not null, amount numeric(12,2) not null,
  metadata jsonb not null default '{}', description text not null, created_at timestamptz not null default now(),
  unique(user_id,type,reference_type,reference_id)
);
create index ledger_user_date on public.points_ledger(user_id,created_at);

create function public.is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select coalesce((select is_admin from profiles where id=auth.uid()),false) $$;
create function public.enforce_submission() returns trigger language plpgsql security definer set search_path=public as $$
declare wk competition_weeks; total numeric; gotw_count int; own_count int;
begin
 select * into wk from competition_weeks where id=new.competition_week_id;
 if wk.id is null or not wk.is_active_betting_week or now()>=wk.lock_at then raise exception 'Picks are locked'; end if;
 if new.user_id<>auth.uid() and not is_admin() then raise exception 'Not allowed'; end if;
 if tg_op='UPDATE' then select coalesce(sum(stake),0),count(*) filter(where kind='gotw'),count(*) filter(where kind='own') into total,gotw_count,own_count from picks where submission_id=new.id;
   if total<>10 or gotw_count<>1 or own_count<>1 then raise exception 'Two picks must total 10'; end if;
 end if; return new;
end $$;
create trigger enforce_weekly_submission before insert or update on public.weekly_submissions for each row execute function public.enforce_submission();
create function public.enforce_challenge() returns trigger language plpgsql security definer set search_path=public as $$
declare lock_time timestamptz;
begin select lock_at into lock_time from competition_weeks where id=new.competition_week_id;
 if new.challenger_id<>auth.uid() or now()>=lock_time then raise exception 'Challenge is invalid or locked'; end if; return new;
end $$;
create trigger enforce_new_challenge before insert on public.challenges for each row execute function public.enforce_challenge();

create function public.submit_weekly_picks(
  p_week_id uuid, p_gotw_fixture_id uuid, p_gotw_outcome public.outcome, p_gotw_stake numeric,
  p_own_fixture_id uuid, p_own_outcome public.outcome, p_own_stake numeric
) returns uuid language plpgsql security definer set search_path=public as $$
declare wk competition_weeks; submission uuid; gotw fixture_odds; own fixture_odds;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into wk from competition_weeks where id=p_week_id for update;
  if wk.id is null or not wk.is_active_betting_week or now()>=wk.lock_at then raise exception 'Picks are locked'; end if;
  if p_gotw_stake<1 or p_own_stake<1 or p_gotw_stake+p_own_stake<>10 then raise exception 'Stakes must total exactly 10'; end if;
  if not exists(select 1 from fixtures where id=p_gotw_fixture_id and competition_week_id=p_week_id and is_eligible and is_gotw)
    or not exists(select 1 from fixtures where id=p_own_fixture_id and competition_week_id=p_week_id and is_eligible and not is_gotw)
    then raise exception 'Invalid fixtures'; end if;
  select * into gotw from fixture_odds where fixture_id=p_gotw_fixture_id order by captured_at desc limit 1;
  select * into own from fixture_odds where fixture_id=p_own_fixture_id order by captured_at desc limit 1;
  insert into weekly_submissions(user_id,competition_week_id,source) values(auth.uid(),p_week_id,'manual')
    on conflict(user_id,competition_week_id) do update set submitted_at=now(),source='manual' returning id into submission;
  delete from picks where submission_id=submission;
  insert into picks(submission_id,fixture_id,kind,selected_outcome,stake,odds) values
    (submission,p_gotw_fixture_id,'gotw',p_gotw_outcome,p_gotw_stake,
      case p_gotw_outcome when 'home' then gotw.home when 'draw' then gotw.draw else gotw.away end),
    (submission,p_own_fixture_id,'own',p_own_outcome,p_own_stake,
      case p_own_outcome when 'home' then own.home when 'draw' then own.draw else own.away end);
  return submission;
end $$;

alter table public.profiles enable row level security; alter table public.email_preferences enable row level security;
alter table public.teams enable row level security; alter table public.competition_weeks enable row level security;
alter table public.fixtures enable row level security; alter table public.fixture_odds enable row level security;
alter table public.weekly_submissions enable row level security; alter table public.picks enable row level security;
alter table public.challenges enable row level security; alter table public.points_ledger enable row level security;
create policy "read own profile" on public.profiles for select using(id=auth.uid() or is_admin());
create policy "update own display name" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "own email preferences" on public.email_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "authenticated reads schedule" on public.teams for select to authenticated using(true);
create policy "authenticated reads weeks" on public.competition_weeks for select to authenticated using(true);
create policy "authenticated reads fixtures" on public.fixtures for select to authenticated using(true);
create policy "authenticated reads odds" on public.fixture_odds for select to authenticated using(true);
create policy "submission visibility" on public.weekly_submissions for select using(user_id=auth.uid() or is_admin() or exists(select 1 from competition_weeks w where w.id=competition_week_id and now()>=w.lock_at));
create policy "pick visibility" on public.picks for select using(exists(select 1 from weekly_submissions s join competition_weeks w on w.id=s.competition_week_id where s.id=submission_id and (s.user_id=auth.uid() or is_admin() or now()>=w.lock_at)));
create policy "read challenges" on public.challenges for select to authenticated using(true);
create policy "create challenge" on public.challenges for insert with check(challenger_id=auth.uid());
create policy "read own ledger" on public.points_ledger for select using(user_id=auth.uid() or is_admin());
create policy "admin profiles" on public.profiles for all using(is_admin()) with check(is_admin());
create policy "admin weeks" on public.competition_weeks for all using(is_admin()) with check(is_admin());
create policy "admin fixtures" on public.fixtures for all using(is_admin()) with check(is_admin());
create policy "admin odds" on public.fixture_odds for all using(is_admin()) with check(is_admin());
create policy "admin ledger" on public.points_ledger for all using(is_admin()) with check(is_admin());
