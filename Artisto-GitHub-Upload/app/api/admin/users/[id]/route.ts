import { serializeListing } from "../../../../../lib/supabase/listings";
import { requireSupabaseAdmin } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: Context) {
  const auth = await requireSupabaseAdmin(request);
  if (!auth.data) return auth.response;
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return Response.json({ error: "Invalid user ID." }, { status: 400 });
  const [profile, listings, saves] = await Promise.all([
    auth.data.admin.from("profiles").select("id, username, display_name, profile_completed, role").eq("id", id).single(),
    auth.data.admin.from("listings").select("*, profiles!listings_owner_id_fkey(display_name, username)").eq("owner_id", id).order("created_at", { ascending: false }),
    auth.data.admin.from("saves").select("listing_id", { count: "exact", head: true }).eq("user_id", id),
  ]);
  if (profile.error) return Response.json({ error: "User not found." }, { status: 404 });
  if (listings.error) return Response.json({ error: listings.error.message }, { status: 400 });
  if (saves.error) return Response.json({ error: saves.error.message }, { status: 400 });
  return Response.json({ profile: profile.data, listings: (listings.data ?? []).map(row => serializeListing(row as Record<string, unknown>)), savedCount: saves.count ?? 0 });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireSupabaseAdmin(request);
  if (!auth.data) return auth.response;
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return Response.json({ error: "Invalid user ID." }, { status: 400 });
  const body = await request.json() as { displayName?: string };
  const displayName = String(body.displayName ?? "").trim().slice(0, 80);
  if (!displayName) return Response.json({ error: "Enter a display name." }, { status: 400 });
  const result = await auth.data.admin
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, username, display_name, profile_completed, role")
    .single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ profile: result.data });
}
