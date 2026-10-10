-- Wordhunter database schema. Paste into Supabase: SQL Editor -> New query -> Run.
-- Safe to re-run.

-- Profiles ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamptz not null default now()
);

-- Streak stats (one row per player) -------------------------------------------
create table if not exists public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  streak integer not null default 0 check (streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  total_solved integer not null default 0 check (total_solved >= 0),
  last_solved_date date,
  updated_at timestamptz not null default now()
);

-- Practice best times (one row per player per puzzle file) ----------------------
create table if not exists public.practice_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_file text not null,
  best_seconds integer not null check (best_seconds >= 0),
  solves integer not null default 1 check (solves >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, puzzle_file)
);

-- Row Level Security: a player can only touch their own rows ---------------------
alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.practice_progress enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own stats" on public.player_stats;
create policy "own stats" on public.player_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own practice" on public.practice_progress;
create policy "own practice" on public.practice_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create a profile automatically when someone signs up -----------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Let a signed-in player delete their own account (cascades to all their rows) -------
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
