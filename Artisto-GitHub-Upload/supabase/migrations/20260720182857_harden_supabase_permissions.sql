-- Trigger functions are invoked by their triggers and should not be callable
-- through the Data API. The view counter remains deliberately available to
-- anonymous and authenticated visitors.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_listing_save_count() from public, anon, authenticated;
revoke execute on function public.increment_listing_views(uuid) from public;
grant execute on function public.increment_listing_views(uuid) to anon, authenticated;

-- The bucket is public for direct image delivery. Listing every object is not
-- needed and would unnecessarily expose the bucket inventory.
drop policy if exists "Listing images are readable" on storage.objects;
