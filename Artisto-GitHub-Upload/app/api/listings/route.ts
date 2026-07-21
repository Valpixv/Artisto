import { createPublicSupabaseClient, requireSupabaseUser } from "../../../lib/supabase/server";
import { cleanSearchTerm, serializeListing } from "../../../lib/supabase/listings";
import { coordinate } from "../../../lib/supabase/validation";
import { parseContactLinks } from "../../../lib/contacts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = cleanSearchTerm(url.searchParams.get("q") ?? "");
    const category = url.searchParams.get("category");
    const min = Number(url.searchParams.get("min"));
    const max = Number(url.searchParams.get("max"));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    let query = createPublicSupabaseClient()
      .from("listings")
      .select("*, profiles!listings_owner_id_fkey(display_name, username)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%,location_name.ilike.%${search}%`);
    if (category && category !== "All categories") query = query.eq("category", category);
    if (Number.isFinite(min) && min >= 0) query = query.gte("price", min);
    if (Number.isFinite(max) && max > 0) query = query.lte("price", max);
    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ listings: (data ?? []).map(row => serializeListing(row as Record<string, unknown>)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load listings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (!auth.data) return auth.response;
  const { supabase, user } = auth.data;
  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim().slice(0, 120);
    const description = String(form.get("description") ?? "").trim().slice(0, 4000);
    const category = String(form.get("category") ?? "").trim().slice(0, 60);
    const locationName = String(form.get("location") ?? "").trim().slice(0, 180);
    const contactLinks = parseContactLinks(form.get("contactLinks"));
    const contactUrl = contactLinks?.[0]?.value ?? null;
    const price = Number(form.get("price"));
    const latitude = coordinate(form.get("latitude"), -90, 90);
    const longitude = coordinate(form.get("longitude"), -180, 180);
    const image = form.get("image");
    if (!title || !description || !category || !locationName || !Number.isFinite(price) || price < 0) {
      return Response.json({ error: "Complete every required listing field." }, { status: 400 });
    }
    if (!contactLinks || !contactUrl) return Response.json({ error: "Add at least one valid contact link." }, { status: 400 });
    if (!(image instanceof File) || image.size === 0) return Response.json({ error: "Choose one listing image." }, { status: 400 });
    if (image.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      return Response.json({ error: "Use a JPG, PNG, or WebP image up to 8 MB." }, { status: 400 });
    }
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("listing-images").upload(imagePath, image, { contentType: image.type, upsert: false });
    if (upload.error) return Response.json({ error: upload.error.message }, { status: 400 });
    const insert = await supabase.from("listings").insert({
      owner_id: user.id, title, description, category, price, location_name: locationName,
      latitude, longitude,
      image_path: imagePath, contact_url: contactUrl, contact_links: contactLinks, status: "active",
    }).select("*, profiles!listings_owner_id_fkey(display_name, username)").single();
    if (insert.error) {
      await supabase.storage.from("listing-images").remove([imagePath]);
      return Response.json({ error: insert.error.message }, { status: 400 });
    }
    return Response.json({ listing: serializeListing(insert.data as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create listing." }, { status: 500 });
  }
}
