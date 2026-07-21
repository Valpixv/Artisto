import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("keeps the complete marketplace taxonomy, sorting, profiles, and contacts wired into the UI", async () => {
  const [page, contacts] = await Promise.all([read("../app/page.tsx"), read("../lib/contacts.ts")]);

  for (const category of [
    "Paintings", "Prints", "Digital Art", "Jewelry", "Accessories", "Ceramics",
    "Clothing", "Stationery", "Home Decor", "Toys & Plushies", "Crafts",
    "Commissions", "Supplies", "Other",
  ]) assert.match(page, new RegExp(`\\"${category.replace(/[&]/g, "&")}\\"`));

  for (const sort of ["Newest", "Highest Price", "Lowest Price", "Most Saved"])
    assert.match(page, new RegExp(sort));

  assert.match(page, /editable-display-name/);
  assert.match(page, /profile\?\.username/);
  assert.doesNotMatch(page.match(/function AccountPage[\s\S]*?function AdminUsersPage/)?.[0] ?? "", /user\?\.email/);
  assert.match(page, /\+ Add Contact Link/);
  assert.match(page, /Contact seller/);

  for (const platform of [
    "instagram", "tiktok", "facebook", "x", "youtube", "linkedin", "etsy",
    "shopify", "artstation", "deviantart", "discord", "whatsapp", "amazon",
    "website", "email",
  ]) assert.match(contacts, new RegExp(`\\"${platform}\\"`));
});

test("enforces administrator access on the server and keeps the allowlist private", async () => {
  const [server, adminUsers, adminUser, migration, listingRoute] = await Promise.all([
    read("../lib/supabase/server.ts"),
    read("../app/api/admin/users/route.ts"),
    read("../app/api/admin/users/[id]/route.ts"),
    read("../supabase/migrations/20260720214231_secure_admin_management.sql"),
    read("../app/api/listings/[id]/route.ts"),
  ]);

  assert.match(server, /role\.data\?\.role !== "admin"/);
  assert.match(server, /SUPABASE_SECRET_KEY/);
  assert.match(adminUsers, /requireSupabaseAdmin/);
  assert.match(adminUser, /requireSupabaseAdmin/);
  assert.match(listingRoute, /isAdmin \? createAdminSupabaseClient\(\)/);
  assert.match(migration, /create table if not exists private\.admin_accounts/i);
  assert.match(migration, /vulpixvpatreon@gmail\.com/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /display_name_override_enabled/);
});

test("uses a Vercel-compatible Next.js build without abandoned hosting adapters", async () => {
  const [pkg, config, env] = await Promise.all([
    read("../package.json").then(JSON.parse),
    read("../next.config.ts"),
    read("../.env.example"),
  ]);

  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts.start, "next start");
  assert.equal(pkg.packageManager?.startsWith("pnpm@") ?? true, true);
  assert.doesNotMatch(JSON.stringify(pkg), /vinext|cloudflare|wrangler/i);
  assert.match(config, /remotePatterns/);
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_GEOAPIFY_KEY",
  ]) assert.match(env, new RegExp(`^${key}=`, "m"));
});
