import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?reason=supabase", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Default to /login so the existing role-routing in signInWithPassword
  // picks the right landing page (candidate → /me/applications, employer →
  // /employer/<slug>/jobs, admin → /admin/jobs). Anchoring to /admin/jobs
  // would bounce non-admins through a forbidden error on first verify.
  const nextRaw = url.searchParams.get("next") ?? "/login";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/login";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* ignore when not mutable */
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
