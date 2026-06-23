"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase Realtime changes for a tournament and refreshes the
 * server-rendered page so public standings/schedule update instantly.
 */
export function LiveRefresh({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      return; // env not configured
    }
    const channel = supabase
      .channel(`public-tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "pickleball",
          table: "standings",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "pickleball",
          table: "group_matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "pickleball",
          table: "final_matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  return null;
}
