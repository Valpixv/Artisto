create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Artisto seller' check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null constraint listings_owner_id_fkey references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 4000),
  category text not null check (char_length(category) between 1 and 60),
  price numeric(10,2) not null check (price >= 0),
  location_name text not null check (char_length(location_name) between 1 and 180),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  image_path text not null,
  contact_url text not null check (char_length(contact_url) between 1 and 500),
  status text not null default 'active' check (status in ('active','inactive','sold')),
  view_count bigint not null default 0 check (view_count >= 0),
  save_count bigint not null default 0 check (save_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists listings_status_created_idx on public.listings(status, created_at desc);
create index if not exists listings_owner_idx on public.listings(owner_id, created_at desc);
create index if not exists listings_category_price_idx on public.listings(category, price);
create index if not exists saves_listing_idx on public.saves(listing_id);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.saves enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable" on public.profiles for select using (true);
drop policy if exists "Users update their profile" on public.profiles;
create policy "Users update their profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Active listings are public" on public.listings;
create policy "Active listings are public" on public.listings for select using (status = 'active' or (select auth.uid()) = owner_id);
drop policy if exists "Users create their listings" on public.listings;
create policy "Users create their listings" on public.listings for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners update their listings" on public.listings;
create policy "Owners update their listings" on public.listings for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners delete their listings" on public.listings;
create policy "Owners delete their listings" on public.listings for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Users read their saves" on public.saves;
create policy "Users read their saves" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create their saves" on public.saves;
create policy "Users create their saves" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete their saves" on public.saves;
create policy "Users delete their saves" on public.saves for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'Artisto seller'), '@', 1)), new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Backfill profiles when this migration is applied after accounts already exist.
insert into public.profiles (id, display_name, avatar_url)
select
  id,
  coalesce(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(coalesce(email, 'Artisto seller'), '@', 1)),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

create or replace function public.update_listing_save_count() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.listings set save_count = save_count + 1 where id = new.listing_id;
    return new;
  end if;
  update public.listings set save_count = greatest(save_count - 1, 0) where id = old.listing_id;
  return old;
end;
$$;

drop trigger if exists saves_update_listing_count on public.saves;
create trigger saves_update_listing_count after insert or delete on public.saves for each row execute procedure public.update_listing_save_count();

create or replace function public.increment_listing_views(listing_uuid uuid) returns void language sql security definer set search_path = '' as $$
  update public.listings set view_count = view_count + 1 where id = listing_uuid and status = 'active';
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_listing_save_count() from public, anon, authenticated;
revoke execute on function public.increment_listing_views(uuid) from public;
grant execute on function public.increment_listing_views(uuid) to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant select on public.listings to anon, authenticated;
grant insert, delete on public.saves to authenticated;
grant select on public.saves to authenticated;
grant insert on public.listings to authenticated;
grant delete on public.listings to authenticated;
revoke update on public.listings from authenticated;
grant update (title, description, category, price, location_name, latitude, longitude, image_path, contact_url, status, updated_at) on public.listings to authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Listing images are readable" on storage.objects;
drop policy if exists "Users upload listing images" on storage.objects;
create policy "Users upload listing images" on storage.objects for insert to authenticated with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update listing images" on storage.objects;
create policy "Users update listing images" on storage.objects for update to authenticated using (bucket_id = 'listing-images' and owner_id = (select auth.uid())::text) with check (bucket_id = 'listing-images' and owner_id = (select auth.uid())::text);
drop policy if exists "Users delete listing images" on storage.objects;
create policy "Users delete listing images" on storage.objects for delete to authenticated using (bucket_id = 'listing-images' and owner_id = (select auth.uid())::text);
