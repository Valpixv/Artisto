create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.admin_accounts (
  email text primary key check (email = lower(email) and char_length(email) between 3 and 254),
  created_at timestamptz not null default now()
);
alter table private.admin_accounts enable row level security;
revoke all on private.admin_accounts from public, anon, authenticated;

insert into private.admin_accounts (email)
values ('vulpixvpatreon@gmail.com')
on conflict (email) do nothing;

alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_allowed'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_allowed check (role in ('user', 'admin'));
  end if;
end $$;

update public.profiles as profile
set role = 'admin', updated_at = now()
from auth.users as account
where account.id = profile.id
  and lower(account.email) in (select email from private.admin_accounts);

update public.profiles
set role = 'user', updated_at = now()
where role = 'admin'
  and id not in (
    select account.id
    from auth.users as account
    join private.admin_accounts as allowed on allowed.email = lower(account.email)
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'Artisto seller'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when exists (select 1 from private.admin_accounts where email = lower(new.email)) then 'admin'
      else 'user'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.listings
  add column if not exists display_name_override text,
  add column if not exists display_name_override_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_display_name_override_valid'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_display_name_override_valid check (
        not display_name_override_enabled
        or char_length(trim(coalesce(display_name_override, ''))) between 1 and 80
      );
  end if;
end $$;

-- Normal users intentionally receive no UPDATE grant for role or listing override columns.
-- Administrator mutations use the server-only Supabase secret after a database role check.
