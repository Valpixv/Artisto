alter table public.listings
  add column if not exists contact_links jsonb not null default '[]'::jsonb;

update public.listings
set contact_links = jsonb_build_array(jsonb_build_object(
  'platform', case
    when lower(contact_url) like '%instagram%' then 'instagram'
    when lower(contact_url) like '%tiktok%' then 'tiktok'
    when lower(contact_url) like '%facebook%' or lower(contact_url) like '%fb.com%' then 'facebook'
    when lower(contact_url) like '%twitter%' or lower(contact_url) like '%x.com%' then 'x'
    when lower(contact_url) like '%youtube%' or lower(contact_url) like '%youtu.be%' then 'youtube'
    when lower(contact_url) like '%linkedin%' then 'linkedin'
    when lower(contact_url) like '%etsy%' then 'etsy'
    when lower(contact_url) like '%shopify%' then 'shopify'
    when lower(contact_url) like '%artstation%' then 'artstation'
    when lower(contact_url) like '%deviantart%' then 'deviantart'
    when lower(contact_url) like '%discord%' then 'discord'
    when lower(contact_url) like '%whatsapp%' or lower(contact_url) like '%wa.me%' then 'whatsapp'
    when lower(contact_url) like '%amazon%' then 'amazon'
    when lower(contact_url) like 'mailto:%' or contact_url like '%@%' then 'email'
    else 'website'
  end,
  'value', case when lower(contact_url) = 'etsy' then 'https://www.etsy.com/' else contact_url end
))
where contact_links = '[]'::jsonb and contact_url <> '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_contact_links_array'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings add constraint listings_contact_links_array
      check (jsonb_typeof(contact_links) = 'array' and jsonb_array_length(contact_links) between 1 and 15);
  end if;
end
$$;

grant update (contact_links) on public.listings to authenticated;

