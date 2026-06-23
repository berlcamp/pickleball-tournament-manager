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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
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
