import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "";

export interface AuthUser {
  userId: string;
  email?: string;
}

/**
 * Resolve the authenticated user from request headers.
 * Supports Supabase JWT (Authorization: Bearer <token>) and
 * a dev/testing API key fallback (X-API-Key header).
 */
export async function resolveUser(
  headers: Record<string, string>,
): Promise<AuthUser> {
  // 1. API key fallback (dev / testing)
  const apiKey = headers["x-api-key"];
  if (apiKey && AUTH_SECRET && apiKey === AUTH_SECRET) {
    return { userId: "api-key-user", email: "dev@gearai.local" };
  }

  // 2. Supabase JWT
  const authHeader = headers["authorization"] ?? headers["Authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }

  const token = authHeader.slice(7);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error(error?.message ?? "Invalid or expired token");
  }

  return { userId: user.id, email: user.email };
}

/**
 * Create a Supabase client scoped to the user's JWT so that
 * Row-Level Security (RLS) policies are enforced.
 */
export function createUserScopedClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
