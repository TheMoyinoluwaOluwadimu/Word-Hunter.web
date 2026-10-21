-- WordChunk: lets the app choose a challenge's seed (which decides its five words).
-- Run once in the SQL Editor -> New query -> paste -> Run. Safe to re-run.
-- Until it is run, challenges still work: the server just picks the seed itself, so the app
-- cannot steer new challenges away from words a player has already seen.

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

revoke all on function public.create_challenge(text, integer) from public, anon;
grant execute on function public.create_challenge(text, integer) to authenticated;
