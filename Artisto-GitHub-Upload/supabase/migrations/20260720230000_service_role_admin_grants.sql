-- The secret-key client authenticates as service_role. RLS bypass does not
-- replace ordinary PostgreSQL privileges, so grant only the tables used by
-- administrator APIs and their storage operations.
grant usage on schema public, storage to service_role;
grant select, update on table public.profiles to service_role;
grant select, insert, update, delete on table public.listings to service_role;
grant select, insert, update, delete on table public.saves to service_role;
grant select, insert, update, delete on table storage.objects to service_role;
