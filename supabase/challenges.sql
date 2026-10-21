-- WordChunk challenges. Run AFTER schema.sql: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- Flow: the creator spins a puzzle (create_challenge), plays it (start_challenge ->
-- finish_challenge), then shares the code. Anyone with the code can view it
-- (get_challenge), and once signed in, play it exactly once on the same board.
--
-- The tables are read-only to clients. Every write goes through the functions below,
-- so the server, not the browser, decides start times and final times.

-- Tables --------------------------------------------------------------------------

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  -- short, shareable, case-insensitive (stored upper-case, no 0/O/1/I/L to avoid typos)
  code text not null unique,
  puzzle_file text not null check (puzzle_file ~ '^[A-Za-z0-9_-]+\.json$'),
  -- shuffle seed, so every player gets the identical board
  seed integer not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index if not exists challenges_created_by_idx on public.challenges (created_by, created_at desc);

create table if not exists public.challenge_entries (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- set by the server when the board is shown; reloading never resets it
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- what the browser's timer said, kept for debugging
  client_seconds integer,
  -- the official time (see finish_challenge)
  seconds integer check (seconds >= 0),
  primary key (challenge_id, user_id)
);

create index if not exists challenge_entries_user_idx on public.challenge_entries (user_id);

-- Row Level Security: participants may read, nobody may write directly -------------

alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;

-- security definer so the entries policy can look at entries without recursing into itself
create or replace function public.is_challenge_participant(p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from challenges where id = p_challenge and created_by = auth.uid())
      or exists (select 1 from challenge_entries where challenge_id = p_challenge and user_id = auth.uid());
$$;

drop policy if exists "participants read challenges" on public.challenges;
create policy "participants read challenges" on public.challenges
  for select using (public.is_challenge_participant(id));

drop policy if exists "participants read entries" on public.challenge_entries;
create policy "participants read entries" on public.challenge_entries
  for select using (public.is_challenge_participant(challenge_id));

-- No insert/update/delete policies: direct writes are refused.

-- Helpers --------------------------------------------------------------------------

create or replace function public.challenge_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Public view of a challenge: no seed, no user ids, just names and times.
create or replace function public.challenge_view(c public.challenges)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', c.code,
    'puzzle_file', c.puzzle_file,
    'created_at', c.created_at,
    'expires_at', c.expires_at,
    'expired', c.expires_at < now(),
    'is_creator', c.created_by = auth.uid(),
    'creator_name', (select username from profiles where id = c.created_by),
    'creator_finished', exists (
      select 1 from challenge_entries
      where challenge_id = c.id and user_id = c.created_by and finished_at is not null
    ),
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', p.username,
          'seconds', e.seconds,
          'finished', e.finished_at is not null,
          'is_creator', e.user_id = c.created_by,
          'is_me', e.user_id = auth.uid()
        )
        order by e.seconds nulls last, e.started_at
      )
      from challenge_entries e
      left join profiles p on p.id = e.user_id
      where e.challenge_id = c.id
    ), '[]'::jsonb)
  );
$$;

-- API ----------------------------------------------------------------------------

-- Creates a challenge on the given puzzle. Returns the code; the creator plays next.
-- p_seed (optional) decides which five words the board shows and how its tiles are shuffled. The app picks
-- one that avoids words the creator has already played; without it the server picks a random seed.
drop function if exists public.create_challenge(text);
create or replace function public.create_challenge(p_puzzle_file text, p_seed integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_seed integer := coalesce(p_seed, floor(random() * 2147483646)::int + 1);
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if p_puzzle_file !~ '^[A-Za-z0-9_-]+\.json$' then raise exception 'bad_puzzle'; end if;
  if v_seed < 1 then raise exception 'bad_puzzle'; end if;
  if (select count(*) from challenges
      where created_by = v_uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many_challenges';
  end if;

  loop
    v_code := challenge_code();
    begin
      insert into challenges (code, puzzle_file, seed, created_by)
      values (v_code, p_puzzle_file, v_seed, v_uid);
      exit;
    exception when unique_violation then
      -- code collision: try another
    end;
  end loop;

  return jsonb_build_object('code', v_code);
end;
$$;

-- Anyone with the code (signed in or not) can look at a challenge. Null if it doesn't exist.
create or replace function public.get_challenge(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c challenges;
begin
  select * into c from challenges where code = upper(trim(p_code));
  if not found then return null; end if;
  return challenge_view(c);
end;
$$;

-- Starts (or resumes) the caller's one attempt and reveals the seed. Call it when the
-- board appears: the server clock starts now, and a reload keeps the original start.
create or replace function public.start_challenge(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c challenges;
  e challenge_entries;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  select * into c from challenges where code = upper(trim(p_code));
  if not found then raise exception 'not_found'; end if;

  select * into e from challenge_entries where challenge_id = c.id and user_id = v_uid;
  if found then
    if e.finished_at is not null then raise exception 'already_played'; end if;
  else
    if c.created_by <> v_uid then
      if c.expires_at < now() then raise exception 'expired'; end if;
      if not exists (select 1 from challenge_entries
                     where challenge_id = c.id and user_id = c.created_by and finished_at is not null) then
        raise exception 'not_ready';
      end if;
    end if;
    insert into challenge_entries (challenge_id, user_id) values (c.id, v_uid) returning * into e;
  end if;

  return jsonb_build_object(
    'puzzle_file', c.puzzle_file,
    'seed', c.seed,
    'started_at', e.started_at,
    'server_now', now()
  );
end;
$$;

-- Records the caller's finish. The official time is the browser's, but never more than
-- 5 seconds faster than the server's own clock (network grace), so faking a quick time
-- or reloading to restart the timer doesn't help.
create or replace function public.finish_challenge(p_code text, p_client_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c challenges;
  e challenge_entries;
  v_elapsed integer;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  select * into c from challenges where code = upper(trim(p_code));
  if not found then raise exception 'not_found'; end if;

  select * into e from challenge_entries
  where challenge_id = c.id and user_id = v_uid
  for update;
  if not found then raise exception 'not_started'; end if;
  if e.finished_at is not null then raise exception 'already_played'; end if;

  v_elapsed := floor(extract(epoch from now() - e.started_at))::int;

  update challenge_entries
  set finished_at = now(),
      client_seconds = p_client_seconds,
      seconds = greatest(coalesce(p_client_seconds, v_elapsed), v_elapsed - 5, 0)
  where challenge_id = c.id and user_id = v_uid;

  return challenge_view(c);
end;
$$;

-- The caller's challenges from the last 30 days, newest first.
create or replace function public.list_my_challenges()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  from (
    select
      c.created_at,
      jsonb_build_object(
        'code', c.code,
        'puzzle_file', c.puzzle_file,
        'created_at', c.created_at,
        'expires_at', c.expires_at,
        'expired', c.expires_at < now(),
        'is_creator', c.created_by = auth.uid(),
        'creator_name', p.username,
        'my_seconds', me.seconds,
        'my_finished', me.finished_at is not null,
        'players', (select count(*) from challenge_entries x where x.challenge_id = c.id),
        'best_seconds', (select min(x.seconds) from challenge_entries x where x.challenge_id = c.id)
      ) as row_data
    from challenges c
    join challenge_entries me on me.challenge_id = c.id and me.user_id = auth.uid()
    left join profiles p on p.id = c.created_by
    where c.created_at > now() - interval '30 days'
    order by c.created_at desc
    limit 50
  ) s;
$$;

-- Permissions ---------------------------------------------------------------------

revoke all on function public.challenge_code() from public, anon, authenticated;
revoke all on function public.challenge_view(public.challenges) from public, anon, authenticated;
revoke all on function public.create_challenge(text, integer) from public, anon;
revoke all on function public.start_challenge(text) from public, anon;
revoke all on function public.finish_challenge(text, integer) from public, anon;
revoke all on function public.list_my_challenges() from public, anon;
revoke all on function public.get_challenge(text) from public;

grant execute on function public.is_challenge_participant(uuid) to anon, authenticated;
grant execute on function public.get_challenge(text) to anon, authenticated;
grant execute on function public.create_challenge(text, integer) to authenticated;
grant execute on function public.start_challenge(text) to authenticated;
grant execute on function public.finish_challenge(text, integer) to authenticated;
grant execute on function public.list_my_challenges() to authenticated;
