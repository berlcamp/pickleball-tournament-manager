import Link from "next/link";
import { Trophy } from "lucide-react";
import { requireUser, getProfile } from "@/lib/auth";
import { UserMenu } from "@/components/dashboard/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

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
      <header className="glass sticky top-0 z-20 border-b border-border/50">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="size-4.5" />
            </span>
            <span className="text-gradient">PicklePro</span>
            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
              by Sortbrite
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu name={name} email={user.email ?? ""} avatarUrl={avatar} />
          </div>
        </div>
      </header>
      <main className="flex-1 p-6">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
