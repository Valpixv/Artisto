alter table public.profiles
  add column if not exists username text,
  add column if not exists profile_completed boolean not null default false;

-- Existing members are returning users. Give them a stable private-safe handle so
-- this new onboarding step is shown only to accounts created after this migration.
update public.profiles
set
  username = 'artist_' || left(replace(id::text, '-', ''), 12),
  profile_completed = true
where username is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9_]{3,30}$');
  end if;
end
$$;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, profile_completed, updated_at)
  on public.profiles to authenticated;
