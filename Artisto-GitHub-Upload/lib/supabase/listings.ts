import { publicImageUrl } from "./server";
import { inferLegacyPlatform, type ContactLink } from "../contacts";

export function serializeListing(row: Record<string, unknown>) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const displayName = profile && typeof profile === "object" && "display_name" in profile
    ? String((profile as { display_name?: string }).display_name ?? "Artisto seller")
    : "Artisto seller";
  const username = profile && typeof profile === "object" && "username" in profile
    ? String((profile as { username?: string | null }).username ?? "").trim()
    : "";
  const storedLinks = Array.isArray(row.contact_links) ? row.contact_links as ContactLink[] : [];
  const legacyContact = String(row.contact_url ?? "");
  const contactLinks = storedLinks.length ? storedLinks : legacyContact
    ? [{ platform: inferLegacyPlatform(legacyContact), value: legacyContact }]
    : [];
  const originalSeller = displayName;
  const overrideEnabled = row.display_name_override_enabled === true;
  const overrideName = String(row.display_name_override ?? "").trim();
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    title: String(row.title),
    category: String(row.category),
    description: String(row.description),
    price: Number(row.price),
    location: String(row.location_name),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    seller: overrideEnabled && overrideName ? overrideName : originalSeller,
    originalSeller,
    sellerUsername: username || null,
    displayNameOverride: overrideName || null,
    displayNameOverrideEnabled: overrideEnabled,
    contact: contactLinks[0]?.value ?? legacyContact,
    contactLinks,
    imagePath: row.image_path ? String(row.image_path) : null,
    imageUrl: publicImageUrl(row.image_path ? String(row.image_path) : null),
    crop: "center",
    views: Number(row.view_count ?? 0),
    saves: Number(row.save_count ?? 0),
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

export function cleanSearchTerm(value: string) {
  return value.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
