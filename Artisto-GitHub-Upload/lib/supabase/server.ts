import { createClient } from "@supabase/supabase-js";
import { type UserClaims } from "@supabase/server";
import { createContextClient, verifyAuth } from "@supabase/server/core";
import type { Database } from "./database.types";

function configuredEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  if (!url || !publishableKey) throw new Error("Supabase server environment is not configured.");
  return {
    url,
    publishableKeys: { default: publishableKey },
    secretKeys: {},
    jwks: jwksUrl ? new URL(jwksUrl) : null,
  };
}

export function createPublicSupabaseClient() {
  const env = configuredEnv();
  return createClient<Database>(env.url, env.publishableKeys.default, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createAdminSupabaseClient() {
  const env = configuredEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required for administrator operations.");
  return createClient<Database>(env.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireSupabaseUser(request: Request) {
  const env = configuredEnv();
  const result = await verifyAuth(request, { auth: "user", env });
  if (result.error) {
    return { data: null, response: Response.json({ error: result.error.message }, { status: result.error.status }) };
  }
  const supabase = createContextClient<Database>({ auth: { token: result.data.token }, env });
  return {
    data: { supabase, user: result.data.userClaims as UserClaims },
    response: null,
  };
}

export async function requireSupabaseAdmin(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (!auth.data) return auth;
  const role = await auth.data.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.data.user.id)
    .single();
  if (role.error || role.data?.role !== "admin") {
    return { data: null, response: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  }
  try {
    return {
      data: { ...auth.data, admin: createAdminSupabaseClient() },
      response: null,
    };
  } catch (error) {
    return {
      data: null,
      response: Response.json({ error: error instanceof Error ? error.message : "Administrator access is unavailable." }, { status: 503 }),
    };
  }
}

export function publicImageUrl(path: string | null) {
  if (!path) return null;
  return createPublicSupabaseClient().storage.from("listing-images").getPublicUrl(path).data.publicUrl;
}
