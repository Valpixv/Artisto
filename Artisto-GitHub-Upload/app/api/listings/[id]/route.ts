import { createAdminSupabaseClient, requireSupabaseUser } from "../../../../lib/supabase/server";
import { serializeListing } from "../../../../lib/supabase/listings";
import { coordinate } from "../../../../lib/supabase/validation";
import { parseContactLinks } from "../../../../lib/contacts";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function listingManager(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (!auth.data) return auth;
  const role = await auth.data.supabase.from("profiles").select("role").eq("id", auth.data.user.id).single();
  const isAdmin = !role.error && role.data?.role === "admin";
  return {
    data: { ...auth.data, isAdmin, manager: isAdmin ? createAdminSupabaseClient() : auth.data.supabase },
    response: null,
  };
}

export async function PATCH(request: Request, context: Context) {
  const auth = await listingManager(request);
  if (!auth.data) return auth.response;
  const { id } = await context.params;
  const { manager, user, isAdmin } = auth.data;
  try {
    const existing = await manager.from("listings").select("owner_id, image_path, contact_url, contact_links").eq("id", id).single();
    if (existing.error || (!isAdmin && existing.data.owner_id !== user.id)) return Response.json({ error: "Listing not found." }, { status: 404 });
    const form = await request.formData();
    const contactLinks = parseContactLinks(form.get("contactLinks"));
    const contactUrl = contactLinks?.[0]?.value ?? null;
    const fields = {
      title: String(form.get("title") ?? "").trim().slice(0, 120),
      description: String(form.get("description") ?? "").trim().slice(0, 4000),
      category: String(form.get("category") ?? "").trim().slice(0, 60),
      price: Number(form.get("price")),
      location_name: String(form.get("location") ?? "").trim().slice(0, 180),
      contact_url: contactUrl ?? "",
      contact_links: contactLinks ?? [],
      latitude: coordinate(form.get("latitude"), -90, 90),
      longitude: coordinate(form.get("longitude"), -180, 180),
      updated_at: new Date().toISOString(),
    };
    const overrideEnabled = form.get("displayNameOverrideEnabled") === "true";
    const overrideName = String(form.get("displayNameOverride") ?? "").trim().slice(0, 80);
    if (!fields.title || !fields.description || !fields.category || !fields.location_name || !fields.contact_url || !Number.isFinite(fields.price) || fields.price < 0) {
      return Response.json({ error: "Complete every required listing field." }, { status: 400 });
    }
    if (!contactLinks) return Response.json({ error: "Check every contact link and remove duplicate platforms." }, { status: 400 });
    if (isAdmin && overrideEnabled && !overrideName) return Response.json({ error: "Enter a listing display name or disable the override." }, { status: 400 });
    let nextImagePath = existing.data.image_path as string;
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      if (image.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) return Response.json({ error: "Use a JPG, PNG, or WebP image up to 8 MB." }, { status: 400 });
      const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
      nextImagePath = `${existing.data.owner_id}/${crypto.randomUUID()}.${extension}`;
      const upload = await manager.storage.from("listing-images").upload(nextImagePath, image, { contentType: image.type });
      if (upload.error) return Response.json({ error: upload.error.message }, { status: 400 });
    }
    const overrideFields = isAdmin ? { display_name_override: overrideName || null, display_name_override_enabled: overrideEnabled } : {};
    const update = await manager.from("listings").update({ ...fields, ...overrideFields, image_path: nextImagePath }).eq("id", id).select("*, profiles!listings_owner_id_fkey(display_name, username)").single();
    if (update.error) {
      if (nextImagePath !== existing.data.image_path) await manager.storage.from("listing-images").remove([nextImagePath]);
      return Response.json({ error: update.error.message }, { status: 400 });
    }
    if (nextImagePath !== existing.data.image_path) await manager.storage.from("listing-images").remove([existing.data.image_path]);
    return Response.json({ listing: serializeListing(update.data as Record<string, unknown>) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update listing." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await listingManager(request);
  if (!auth.data) return auth.response;
  const { id } = await context.params;
  const { manager, user, isAdmin } = auth.data;
  const existing = await manager.from("listings").select("owner_id, image_path").eq("id", id).single();
  if (existing.error || (!isAdmin && existing.data.owner_id !== user.id)) return Response.json({ error: "Listing not found." }, { status: 404 });
  const removed = await manager.from("listings").delete().eq("id", id);
  if (removed.error) return Response.json({ error: removed.error.message }, { status: 400 });
  if (existing.data.image_path) await manager.storage.from("listing-images").remove([existing.data.image_path]);
  return new Response(null, { status: 204 });
}
