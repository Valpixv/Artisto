import { createPublicSupabaseClient } from "../../../../../lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { error } = await createPublicSupabaseClient().rpc("increment_listing_views", { listing_uuid: id });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return new Response(null, { status: 204 });
}
