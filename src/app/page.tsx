import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUser } from "@/lib/auth";
import {
  Trophy,
  CalendarClock,
  Users,
  BarChart3,
  Tv,
  QrCode,
  Shuffle,
  Network,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Teams & Collaboration",
    desc: "Add teams, bulk import, and invite owners, admins and scorekeepers.",
    iconBg: "bg-primary/15 text-primary",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-primary)]",
  },
  {
    icon: Shuffle,
    title: "Smart Seeding & Groups",
    desc: "Drag-and-drop or animated random seeding with snake group generation.",
    iconBg: "bg-chart-2/15 text-chart-2",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-2)]",
  },
  {
    icon: BarChart3,
    title: "Live Standings",
    desc: "Round robin standings with tie-breakers, updated after every score.",
    iconBg: "bg-chart-3/15 text-chart-3",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-3)]",
  },
  {
    icon: Network,
    title: "Finals Brackets",
    desc: "Auto-generate crossover or standard-seed knockout brackets.",
    iconBg: "bg-chart-5/15 text-chart-5",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-5)]",
  },
  {
    icon: CalendarClock,
    title: "Smart Scheduling",
    desc: "Spread matches across courts with rest periods and conflict detection.",
    iconBg: "bg-chart-4/15 text-chart-4",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-4)]",
  },
  {
    icon: Tv,
    title: "Live Monitor & QR",
    desc: "TV-mode now-playing board and shareable QR codes for spectators.",
    iconBg: "bg-chart-2/15 text-chart-2",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-2)]",
  },
];

export default async function Home() {
  const user = await getUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between p-6">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Trophy className="size-5" />
          </span>
          <span className="text-gradient">PicklePro</span>
          <span className="hidden text-sm font-normal text-muted-foreground sm:inline">
            by Sortbrite
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild>
            <Link href={user ? "/dashboard" : "/login"}>
              {user ? "Dashboard" : "Sign in"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6">
        <section className="flex flex-col items-center py-20 text-center">
          <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight sm:text-6xl">
            Run <span className="text-gradient">pickleball tournaments</span>{" "}
            without the spreadsheets
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Round robin groups, finals brackets, smart court scheduling and live
            public standings. Built for organizers, loved by players.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-13 rounded-xl px-8 text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35"
            >
              <Link href={user ? "/dashboard/tournaments/new" : "/login"}>
                Create a tournament
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-13 rounded-xl px-8 text-base font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <Link href="/monitor">View live monitor</Link>
            </Button>
          </div>
        </section>

        <section className="grid w-full gap-5 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`group glass relative overflow-hidden rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${f.glow}`}
            >
              <span
                className={`mb-5 grid size-13 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${f.iconBg}`}
              >
                <f.icon className="size-6" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-white/5 py-12 text-center">
        <QrCode className="mx-auto mb-4 size-6 text-primary opacity-70" />
        <p className="text-xl font-semibold tracking-tight sm:text-2xl">
          Built by a pickleball player{" "}
          <span className="text-gradient">for pickleball players</span>
        </p>
      </footer>
    </div>
  );
}
