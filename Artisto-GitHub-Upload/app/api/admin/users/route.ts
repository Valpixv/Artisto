import { requireSupabaseAdmin } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSupabaseAdmin(request);
  if (!auth.data) return auth.response;
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30) ?? "";
  if (!query) return Response.json({ users: [] });
  const result = await auth.data.admin
    .from("profiles")
    .select("id, username, display_name, profile_completed, role")
    .ilike("username", `%${query}%`)
    .order("username", { ascending: true })
    .limit(20);
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ users: result.data ?? [] });
}
