import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` is carried in a cookie (set on the login page) so `redirectTo` can
  // stay query-free; fall back to the query param, then the dashboard.
  const cookieStore = await cookies();
  const next =
    cookieStore.get("auth_next")?.value ??
    searchParams.get("next") ??
    "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure a profile row exists for the signed-in user. The
      // `on_auth_user_created` DB trigger only creates profiles on INSERT into
      // auth.users, so Google accounts that predate that trigger never got one
      // — leaving them without a profile and, in turn, without their pending
      // invites accepted (the `on_profile_accept_invites` trigger fires on
      // profile INSERT). Upserting here backfills the profile on login, which
      // fires that trigger and converts any pending invites into memberships.
      const user = data.user;
      if (user) {
        const meta = user.user_metadata ?? {};
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email ?? "",
            full_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
            avatar_url:
              (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
          },
          { onConflict: "id" },
        );
        if (profileError) {
          // Best-effort: never block login on profile backfill.
          console.error("[auth/callback] profile upsert failed", profileError);
        }
      }
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.delete("auth_next");
      return response;
    }
    console.error("[auth/callback] exchangeCodeForSession failed", error);
    const params = new URLSearchParams({
      error: "auth",
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.status ? { status: String(error.status) } : {}),
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth&message=${encodeURIComponent("No authorization code was returned")}`);
}
