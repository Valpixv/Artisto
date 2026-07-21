import { requireSupabaseUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (!auth.data) return auth.response;
  const { supabase, user } = auth.data;
  const result = await supabase
    .from("profiles")
    .select("id, username, display_name, profile_completed, role")
    .eq("id", user.id)
    .single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ profile: result.data });
}

export async function PATCH(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (!auth.data) return auth.response;
  const { supabase, user } = auth.data;
  const body = await request.json() as { username?: string; displayName?: string };
  const displayName = String(body.displayName ?? "").trim().slice(0, 80);
  if (!displayName) return Response.json({ error: "Enter a display name." }, { status: 400 });
  if (body.username == null) {
    const result = await supabase
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id, username, display_name, profile_completed, role")
      .single();
    if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
    return Response.json({ profile: result.data });
  }
  const username = String(body.username).trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return Response.json({ error: "Use 3–30 lowercase letters, numbers, or underscores for your username." }, { status: 400 });
  }

  const result = await supabase
    .from("profiles")
    .update({ username, display_name: displayName, profile_completed: true, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id, username, display_name, profile_completed, role")
    .single();
  if (result.error) {
    if (result.error.code === "23505") return Response.json({ error: "That username is already taken." }, { status: 409 });
    return Response.json({ error: result.error.message }, { status: 400 });
  }
  return Response.json({ profile: result.data });
}
