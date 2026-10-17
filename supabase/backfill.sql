-- WordChunk leaderboard catch-up. ONE-TIME. Run it in the SQL Editor after re-running leaderboard.sql.
--
-- Why: the leaderboard only ranks solves the server timed. Anyone who played before that was
-- live (or before they signed in) has a streak and a solve count in their own stats but nothing
-- on the board. This credits those, using the numbers already saved in player_stats.
--
--   * Their CURRENT STREAK becomes real days on the streak board (the last N days, ending on the
--     day they last solved). These runs have no time, so they never appear on the Today board.
--   * Any older solves are credited on the All time board only.
--
-- Those stats were written by each player's own browser, so this trusts them once. Two limits keep
-- it honest: nobody can have solved before the first puzzle day (set below), or more than one
-- puzzle per day. Nothing here can be run twice to double-count: runs are one per player per day,
-- and the All time credit is recalculated, not added to.

-- The first day puzzles ran (LAUNCH_DATE in src/config.ts).
drop table if exists _launch;
create temp table _launch as select date '2026-10-13' as day;

-- Who gets credit, and how much.
drop table if exists _eligible;
create temp table _eligible as
select
  s.user_id,
  s.last_solved_date,
  -- solves can't exceed one per day since the first puzzle day
  least(s.total_solved, s.last_solved_date - l.day + 1) as solves,
  -- the streak can't be longer than the solves, or than the days available
  least(s.streak, s.total_solved, s.last_solved_date - l.day + 1) as streak_days
from public.player_stats s, _launch l
where s.total_solved > 0
  and s.streak > 0
  and s.last_solved_date between l.day and (now() at time zone 'utc')::date
  and exists (select 1 from auth.users u where u.id = s.user_id);

-- 1. One finished run (no time) for each day of the current streak, if that day has no run yet.
insert into public.daily_runs (user_id, puzzle_date, started_at, finished_at)
select
  e.user_id,
  e.last_solved_date - g.i,
  ((e.last_solved_date - g.i)::timestamp + time '12:00') at time zone 'utc',
  ((e.last_solved_date - g.i)::timestamp + time '12:00') at time zone 'utc'
from _eligible e, generate_series(0, e.streak_days - 1) as g(i)
on conflict (user_id, puzzle_date) do nothing;

-- 2. Whatever solves the runs above don't account for go on the All time board as credit.
insert into public.leaderboard_credit (user_id, solves)
select
  e.user_id,
  greatest(0, e.solves - (select count(*) from public.daily_runs r
                           where r.user_id = e.user_id and r.finished_at is not null))
from _eligible e
on conflict (user_id) do update set solves = excluded.solves;

-- What it did, per player.
select
  p.username,
  e.last_solved_date,
  e.streak_days as streak_days_credited,
  coalesce(c.solves, 0) as extra_solves_credited,
  (select count(*) from public.daily_runs r where r.user_id = e.user_id and r.finished_at is not null)
    + coalesce(c.solves, 0) as all_time_total
from _eligible e
left join public.profiles p on p.id = e.user_id
left join public.leaderboard_credit c on c.user_id = e.user_id
order by all_time_total desc;

drop table if exists _eligible;
drop table if exists _launch;

-- ---------------------------------------------------------------------------------------------
-- UNDO (only if you need it). Credited runs are the only ones with no time, and the only ones
-- whose start and finish are identical; real runs always have a time.
--
--   delete from public.daily_runs where seconds is null and client_seconds is null and started_at = finished_at;
--   delete from public.leaderboard_credit;
