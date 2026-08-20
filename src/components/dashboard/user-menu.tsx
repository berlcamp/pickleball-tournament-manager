"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, LogOut, Settings, Trophy } from "lucide-react";
import Link from "next/link";
import { initials } from "@/lib/format";

/**
 * Account menu in the dashboard header. It doubles as the app's navigation now
 * that there is no side nav, so the tournament list lives here too.
 *
 * The trigger is a pill with a chevron rather than a bare avatar — an avatar on
 * its own reads as decoration, and nobody clicks it.
 */
export function UserMenu({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
}) {
  const label = name || "Player";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex cursor-pointer items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2.5 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-primary/50 data-[popup-open]:bg-accent/60">
        <Avatar className="size-8 ring-2 ring-border">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={label} />}
          <AvatarFallback>{initials(label || email)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
          {label}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[popup-open]:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="size-10">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={label} />}
            <AvatarFallback>{initials(label || email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{label}</div>
            <div className="truncate text-xs text-muted-foreground">
              {email}
            </div>
          </div>
        </div>

        <DropdownMenuSeparator className="-mx-1.5" />

        <DropdownMenuItem
          render={<Link href="/dashboard" />}
          className="gap-2.5 rounded-lg px-2 py-2 text-sm"
        >
          <Trophy className="size-4 text-muted-foreground" /> Tournaments
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<Link href="/dashboard/settings" />}
          className="gap-2.5 rounded-lg px-2 py-2 text-sm"
        >
          <Settings className="size-4 text-muted-foreground" /> Profile &
          settings
        </DropdownMenuItem>

        <DropdownMenuSeparator className="-mx-1.5" />

        <DropdownMenuItem
          variant="destructive"
          className="gap-2.5 rounded-lg px-2 py-2 text-sm"
          render={<form action="/auth/signout" method="post" />}
        >
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2.5"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
