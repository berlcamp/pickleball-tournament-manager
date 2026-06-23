import Link from "next/link";
import { Trophy } from "lucide-react";
import { requireUser, getProfile } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
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
    <div className="flex min-h-screen">
      <aside className="glass sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 md:flex">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-5 py-5 text-lg font-bold"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Trophy className="size-4.5" />
          </span>
          <span className="text-gradient">PicklePro</span>
        </Link>
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 flex items-center justify-between border-b border-white/5 px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold md:hidden">
            <Trophy className="size-5 text-primary" />
            <span className="text-gradient">PicklePro</span>
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu name={name} email={user.email ?? ""} avatarUrl={avatar} />
          </div>
        </header>
        <main className="flex-1 p-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
