import { requireSupabaseUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (!auth.data) return auth.response;
  const { data, error } = await auth.data.supabase.from("saves").select("listing_id");
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ saved: (data ?? []).map(row => String(row.listing_id)) });
}

export async function POST(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (!auth.data) return auth.response;
  const { supabase, user } = auth.data;
  const listingId = String((await request.json()).listingId ?? "");
  if (!listingId) return Response.json({ error: "Listing ID is required." }, { status: 400 });
  const existing = await supabase.from("saves").select("listing_id").eq("user_id", user.id).eq("listing_id", listingId).maybeSingle();
  if (existing.error) return Response.json({ error: existing.error.message }, { status: 400 });
  if (existing.data) {
    const removed = await supabase.from("saves").delete().eq("user_id", user.id).eq("listing_id", listingId);
    if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 });
    return Response.json({ saved: false });
  }
  const inserted = await supabase.from("saves").insert({ user_id: user.id, listing_id: listingId });
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 400 });
  return Response.json({ saved: true });
}
