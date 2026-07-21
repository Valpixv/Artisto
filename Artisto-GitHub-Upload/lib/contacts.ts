export const contactPlatforms = [
  "instagram", "tiktok", "facebook", "x", "youtube", "linkedin", "etsy", "shopify",
  "artstation", "deviantart", "discord", "whatsapp", "amazon", "website", "email",
] as const;

export type ContactPlatform = typeof contactPlatforms[number];
export type ContactLink = { platform: ContactPlatform; value: string };

export const contactPlatformLabels: Record<ContactPlatform, string> = {
  instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", x: "X", youtube: "YouTube",
  linkedin: "LinkedIn", etsy: "Etsy", shopify: "Shopify", artstation: "ArtStation",
  deviantart: "DeviantArt", discord: "Discord", whatsapp: "WhatsApp", website: "Personal website",
  email: "Email", amazon: "Amazon",
};

const hostRules: Partial<Record<ContactPlatform, RegExp>> = {
  instagram: /(^|\.)instagram\.com$/i,
  tiktok: /(^|\.)tiktok\.com$/i,
  facebook: /(^|\.)facebook\.com$|(^|\.)fb\.com$/i,
  x: /(^|\.)x\.com$|(^|\.)twitter\.com$/i,
  youtube: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i,
  linkedin: /(^|\.)linkedin\.com$/i,
  etsy: /(^|\.)etsy\.com$/i,
  shopify: /(^|\.)myshopify\.com$|(^|\.)shopify\.com$/i,
  artstation: /(^|\.)artstation\.com$/i,
  deviantart: /(^|\.)deviantart\.com$/i,
  discord: /(^|\.)discord\.gg$|(^|\.)discord\.com$/i,
  whatsapp: /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/i,
  amazon: /(^|\.)amazon\.[a-z.]+$/i,
};

export function validateContactLink(link: ContactLink): { url: string | null; error: string | null } {
  const value = link.value.trim();
  const label = contactPlatformLabels[link.platform];
  if (!value) return { url: null, error: `Enter a ${label} contact.` };
  if (link.platform === "email") {
    const email = value.replace(/^mailto:/i, "");
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? { url: `mailto:${email}`, error: null }
      : { url: null, error: "Enter a valid email address." };
  }
  if (link.platform === "whatsapp" && /^\+?[\d\s().-]{7,}$/.test(value)) {
    return { url: `https://wa.me/${value.replace(/\D/g, "")}`, error: null };
  }
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!/^https?:$/.test(url.protocol)) throw new Error("protocol");
    if (link.platform === "website") return { url: url.toString(), error: null };
    const rule = hostRules[link.platform];
    if (rule?.test(url.hostname)) return { url: url.toString(), error: null };
    return { url: null, error: `Enter a valid ${label} link.` };
  } catch {
    return { url: null, error: `Enter a valid ${label} link.` };
  }
}

export function parseContactLinks(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > contactPlatforms.length) return null;
    const seen = new Set<string>();
    const normalized: ContactLink[] = [];
    for (const item of parsed) {
      const platform = String(item?.platform ?? "") as ContactPlatform;
      const raw = String(item?.value ?? "");
      if (!contactPlatforms.includes(platform) || seen.has(platform)) return null;
      const result = validateContactLink({ platform, value: raw });
      if (!result.url) return null;
      seen.add(platform);
      normalized.push({ platform, value: result.url });
    }
    return normalized;
  } catch {
    return null;
  }
}

export function inferLegacyPlatform(value: string): ContactPlatform {
  const lower = value.toLowerCase();
  if (lower.includes("instagram")) return "instagram";
  if (lower.includes("tiktok")) return "tiktok";
  if (lower.includes("facebook") || lower.includes("fb.com")) return "facebook";
  if (lower.includes("twitter") || lower.includes("x.com")) return "x";
  if (lower.includes("youtube") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("linkedin")) return "linkedin";
  if (lower.includes("etsy")) return "etsy";
  if (lower.includes("shopify")) return "shopify";
  if (lower.includes("artstation")) return "artstation";
  if (lower.includes("deviantart")) return "deviantart";
  if (lower.includes("discord")) return "discord";
  if (lower.includes("whatsapp") || lower.includes("wa.me")) return "whatsapp";
  if (lower.includes("amazon")) return "amazon";
  if (lower.startsWith("mailto:") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return "email";
  return "website";
}
