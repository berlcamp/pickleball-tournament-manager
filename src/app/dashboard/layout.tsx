import type { Metadata } from "next";
import { requireUser, getProfile } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { UserMenu } from "@/components/dashboard/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";

/** Everything behind the login is private; keep it out of search results. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const profile = await getProfile();
  const name =
    profile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email ||
    "Player";
  const avatar =
    profile?.avatar_url || (user.user_metadata?.avatar_url as string) || null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* No side nav: the dashboard is the tournament list, and everything
          else hangs off a tournament or the user menu. */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandMark href="/dashboard" />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu
              name={name}
              email={user.email ?? ""}
              avatarUrl={avatar}
              isSuperAdmin={isSuperAdmin(user.email)}
            />
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
