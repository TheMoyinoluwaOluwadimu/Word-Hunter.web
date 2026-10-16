-- WordChunk display names. Run in the SQL Editor after challenges.sql. Safe to re-run.
--
-- Opponents see profiles.username. Until now, email sign-ups got the start of their email
-- address, which shouldn't be shown to strangers. New email accounts now start as "Player1234"
-- (people can rename themselves in the account dialog); Google accounts keep their Google name.

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
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      'Player' || lpad(floor(random() * 10000)::int::text, 4, '0')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Names are 2-24 characters. NOT VALID: existing rows (older, longer names) are left alone,
-- but every new or edited name has to fit.
alter table public.profiles drop constraint if exists profiles_username_len;
alter table public.profiles
  add constraint profiles_username_len
  check (username is null or char_length(username) between 2 and 24) not valid;

-- Optional, one-off: give existing email accounts that still show their email prefix a neutral
-- name. Review the result of the select first, then run the update.
--   select p.id, p.username, u.email
--   from public.profiles p join auth.users u on u.id = p.id
--   where u.email is not null and p.username = split_part(u.email, '@', 1);
--
--   update public.profiles p
--   set username = 'Player' || lpad(floor(random() * 10000)::int::text, 4, '0')
--   from auth.users u
--   where u.id = p.id and p.username = split_part(u.email, '@', 1)
--     and coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name') is null;
