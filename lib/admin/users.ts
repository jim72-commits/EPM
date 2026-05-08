import "server-only";

import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";

/**
 * Server-only helpers that resolve auth.users records for admin views.
 *
 * The regular anon-key client cannot read `auth.users`, so admin pages that
 * need to display emails / look up users by email have to go through the
 * service role. We keep this surface tiny and never expose it from a client
 * boundary — the only callers are admin Server Components and Server Actions
 * that have already passed `requireAdmin()`.
 *
 * If the service role isn't configured (e.g., dev), we degrade gracefully:
 * lookups return null / empty maps, and admin pages fall back to UUIDs.
 */

export type AdminUserSummary = {
  id: string;
  email: string | null;
};

/**
 * Resolve a batch of user UUIDs to their email addresses. Returns a Map keyed
 * by UUID; missing users are simply absent from the map.
 *
 * Uses `auth.admin.listUsers` (paginated). For typical org sizes (<100
 * members) one page is plenty; the helper paginates defensively.
 */
export async function getUsersByIds(
  ids: readonly string[],
): Promise<Map<string, AdminUserSummary>> {
  const out = new Map<string, AdminUserSummary>();
  if (ids.length === 0) return out;
  if (!isServiceRoleAvailable()) return out;

  const wanted = new Set(ids);
  const supabase = createServiceRoleSupabaseClient();

  // listUsers maxes at 1000 per page in current Supabase Auth API. We page
  // until we either fill the wanted set or run out.
  const PAGE_SIZE = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error || !data) break;
    for (const u of data.users) {
      if (wanted.has(u.id)) {
        out.set(u.id, { id: u.id, email: u.email ?? null });
      }
    }
    if (out.size >= wanted.size) break;
    if (data.users.length < PAGE_SIZE) break;
  }

  return out;
}

/**
 * Resolve an email address to its auth.users.id. Returns null if no match,
 * or if the service role isn't configured. Email matching is case-insensitive
 * (auth.users.email is stored lowercased).
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  if (!isServiceRoleAvailable()) return null;

  const supabase = createServiceRoleSupabaseClient();

  // The Supabase JS client doesn't expose a server-side "get by email" call
  // outside `getUserByEmail`, which is undocumented in older versions. We use
  // listUsers with a large page and a client-side filter — fine for the
  // expected admin volumes. If we ever need this hot, switch to a direct
  // SQL hit on auth.users via a security-definer RPC.
  const PAGE_SIZE = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error || !data) break;
    const match = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === trimmed,
    );
    if (match) return match.id;
    if (data.users.length < PAGE_SIZE) break;
  }

  return null;
}
