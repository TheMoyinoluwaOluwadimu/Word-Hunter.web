-- WordChunk leaderboard. Run AFTER schema.sql and challenges.sql: SQL Editor -> New query -> Run.
-- Safe to re-run.
--
-- Every ranking is computed from daily_runs, which clients can only change through
-- start_daily / finish_daily. The server stamps the start, so a time (or a streak, or a
-- solve count) can't be made up from the browser.
--
-- Counting starts from the day this is installed. Solves made before that live only in each
-- player's own stats; run backfill.sql once to credit them.
--
-- Known limit: the puzzle files are public, so someone who writes a script can still
-- "solve" in about the time it takes to wait. The 5-second floor and the server clock stop
-- the casual cheats (edited times, instant solves), not a determined bot.

-- Daily runs ----------------------------------------------------------------------

create table if not exists public.daily_runs (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- the UTC day this run belongs to (the day it started)
  puzzle_date date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  client_seconds integer,
  -- the official time, see finish_daily
  seconds integer check (seconds >= 0),
  primary key (user_id, puzzle_date)
);

create index if not exists daily_runs_today_idx
  on public.daily_runs (puzzle_date, seconds) where finished_at is not null;

alter table public.daily_runs enable row level security;

drop policy if exists "own daily runs" on public.daily_runs;
create policy "own daily runs" on public.daily_runs
  for select using (auth.uid() = user_id);
-- No insert/update/delete policies: direct writes are refused.

-- Solves made before the server timed runs, credited once by backfill.sql. They count on the
-- All time tab only (there is no time or day to attach to them).
create table if not exists public.leaderboard_credit (
  user_id uuid primary key references auth.users (id) on delete cascade,
  solves integer not null default 0 check (solves >= 0)
);

alter table public.leaderboard_credit enable row level security;
-- No policies: only the leaderboard function below (security definer) reads it.

-- Start (or resume) today's run. Call when the first tile is picked up.
create or replace function public.start_daily()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := (now() at time zone 'utc')::date;
  e daily_runs;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;

  select * into e from daily_runs where user_id = v_uid and puzzle_date = v_date;
  if found then
    if e.finished_at is not null then raise exception 'already_played'; end if;
  else
    insert into daily_runs (user_id, puzzle_date) values (v_uid, v_date) returning * into e;
  end if;

  return jsonb_build_object('puzzle_date', e.puzzle_date, 'started_at', e.started_at, 'server_now', now());
end;
$$;

-- Finish the open run. The official time is the browser's, but never more than 5 seconds
-- under what the server's own clock saw between start and finish.
create or replace function public.finish_daily(p_client_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  e daily_runs;
  v_elapsed integer;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;

  select * into e from daily_runs
  where user_id = v_uid and finished_at is null
  order by puzzle_date desc
  limit 1
  for update;

  if not found then
    if exists (select 1 from daily_runs
               where user_id = v_uid and finished_at is not null
                 and puzzle_date = (now() at time zone 'utc')::date) then
      raise exception 'already_played';
    end if;
    raise exception 'not_started';
  end if;

  v_elapsed := floor(extract(epoch from now() - e.started_at))::int;

  update daily_runs
  set finished_at = now(),
      client_seconds = p_client_seconds,
      seconds = greatest(coalesce(p_client_seconds, v_elapsed), v_elapsed - 5, 0)
  where user_id = e.user_id and puzzle_date = e.puzzle_date;

  return jsonb_build_object('puzzle_date', e.puzzle_date);
end;
$$;

-- Leaderboard ----------------------------------------------------------------------

-- p_tab:   'today'   fastest official time on today's puzzle (lowest first)
--          'streak'  current daily streak (a streak survives until the day after the last solve)
--          'alltime' puzzles solved since the leaderboard started
-- p_scope: 'global'  everyone
--          'friends' people you have shared a challenge with, plus you
-- Returns the top p_limit (max 50) and the caller's own row, wherever they stand.
-- Only display names leave the database: no ids, no emails.
create or replace function public.get_leaderboard(
  p_tab text,
  p_scope text default 'global',
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 0), 50);
begin
  if p_tab not in ('today', 'streak', 'alltime') then raise exception 'bad_tab'; end if;
  if p_scope not in ('global', 'friends') then raise exception 'bad_scope'; end if;

  if p_scope = 'friends' and v_uid is null then
    return jsonb_build_object('entries', '[]'::jsonb, 'me', null, 'total', 0);
  end if;

  return (
    with friends as (
      select e2.user_id
        from challenge_entries e1
        join challenge_entries e2 on e2.challenge_id = e1.challenge_id
       where e1.user_id = v_uid
      union
      select c.created_by
        from challenges c
        join challenge_entries e on e.challenge_id = c.id
       where e.user_id = v_uid
      union
      select v_uid
    ),
    base as (
      select r.user_id, r.seconds::numeric as value
        from daily_runs r
       where p_tab = 'today' and r.puzzle_date = v_today and r.finished_at is not null and r.seconds is not null
      union all
      select u.user_id, sum(u.n)::numeric
        from (
          select r.user_id, count(*) as n
            from daily_runs r
           where p_tab = 'alltime' and r.finished_at is not null
           group by r.user_id
          union all
          select c.user_id, c.solves::bigint
            from leaderboard_credit c
           where p_tab = 'alltime'
        ) u
       group by u.user_id
      union all
      select s.user_id, s.n::numeric
        from (
          -- runs of consecutive days: date minus row number is constant within a run
          select t.user_id, count(*) as n, max(t.puzzle_date) as last_day
            from (
              select r.user_id, r.puzzle_date,
                     r.puzzle_date - (row_number() over (partition by r.user_id order by r.puzzle_date))::int as grp
                from daily_runs r
               where p_tab = 'streak' and r.finished_at is not null
            ) t
           group by t.user_id, t.grp
        ) s
       where s.last_day >= v_today - 1
    ),
    ranked as (
      select b.user_id, b.value,
             rank() over (order by case when p_tab = 'today' then b.value else - b.value end) as rnk
        from base b
       where p_scope = 'global' or b.user_id in (select user_id from friends)
    )
    select jsonb_build_object(
      'entries', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'rank', x.rnk,
                   'name', coalesce(nullif(x.username, ''), 'Player'),
                   'value', x.value::int,
                   'is_me', coalesce(x.user_id = v_uid, false)
                 )
                 order by x.rnk, x.username
               )
          from (
            select rk.user_id, rk.value, rk.rnk, p.username
              from ranked rk
              left join profiles p on p.id = rk.user_id
             order by rk.rnk, p.username
             limit v_limit
          ) x
      ), '[]'::jsonb),
      'me', (
        select jsonb_build_object('rank', rk.rnk, 'value', rk.value::int)
          from ranked rk
         where rk.user_id = v_uid
      ),
      'total', (select count(*) from ranked)
    )
  );
end;
$$;

-- Permissions ---------------------------------------------------------------------

revoke all on function public.start_daily() from public, anon;
revoke all on function public.finish_daily(integer) from public, anon;
revoke all on function public.get_leaderboard(text, text, integer) from public;

grant execute on function public.start_daily() to authenticated;
grant execute on function public.finish_daily(integer) to authenticated;
-- the global boards can be viewed signed out; 'friends' returns nothing without a login
grant execute on function public.get_leaderboard(text, text, integer) to anon, authenticated;
