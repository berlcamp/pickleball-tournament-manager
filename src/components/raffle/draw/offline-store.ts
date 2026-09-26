"use client";

import { useSyncExternalStore } from "react";
import type { DrawWinnerResult } from "@/actions/raffle";

/**
 * Offline support for the draw screen, kept in localStorage per raffle:
 *
 * - `pending` — winners drawn on this device without a connection, waiting to
 *   be written to Supabase by `syncOfflineWinners`. They count as winners the
 *   moment they are drawn, so nobody can be drawn twice while offline.
 * - `known`   — the last full winners list this device saw. If the page is
 *   reloaded offline, the service worker serves a cached copy of the page
 *   whose winners may be stale; this list keeps later winners excluded. The
 *   board only leans on it until the server has confirmed the real list, so
 *   an admin clearing winners isn't undone by an old copy.
 */

export type PendingWinner = DrawWinnerResult & {
  raffle_id: string;
  prize_label: string | null;
  drawn_at: string;
};

const pendingKey = (raffleId: string) => `raffle:${raffleId}:pending`;
const knownKey = (raffleId: string) => `raffle:${raffleId}:known`;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab of the same raffle can change the queue too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notify() {
  listeners.forEach((l) => l());
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked — the draw still works, it just won't survive a
    // reload. Nothing more useful to do here.
  }
}

// useSyncExternalStore needs the same array back while the stored string is
// unchanged, so parsed lists are cached by their raw value.
const parsed = new Map<string, { raw: string | null; value: unknown[] }>();
const EMPTY: never[] = [];

function readList<T>(key: string): T[] {
  const raw = readRaw(key);
  const hit = parsed.get(key);
  if (hit && hit.raw === raw) return hit.value as T[];
  let value: T[] = EMPTY;
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) value = data;
    } catch {
      // corrupt entry — treat as empty
    }
  }
  parsed.set(key, { raw, value });
  return value;
}

export function usePendingWinners(raffleId: string): PendingWinner[] {
  return useSyncExternalStore(
    subscribe,
    () => readList<PendingWinner>(pendingKey(raffleId)),
    () => EMPTY,
  );
}

/** The queue as stored right now, outside React (for the sync call). */
export function readPendingWinners(raffleId: string): PendingWinner[] {
  return readList<PendingWinner>(pendingKey(raffleId));
}

export function useKnownWinners(raffleId: string): DrawWinnerResult[] {
  return useSyncExternalStore(
    subscribe,
    () => readList<DrawWinnerResult>(knownKey(raffleId)),
    () => EMPTY,
  );
}

export function addPendingWinner(raffleId: string, winner: PendingWinner) {
  const next = [...readList<PendingWinner>(pendingKey(raffleId)), winner];
  writeRaw(pendingKey(raffleId), JSON.stringify(next));
  notify();
}

export function removePendingWinners(raffleId: string, ids: string[]) {
  const drop = new Set(ids);
  const next = readList<PendingWinner>(pendingKey(raffleId)).filter(
    (w) => !drop.has(w.id),
  );
  writeRaw(pendingKey(raffleId), JSON.stringify(next));
  notify();
}

export function saveKnownWinners(raffleId: string, winners: DrawWinnerResult[]) {
  const raw = JSON.stringify(winners);
  // Skipping unchanged writes (and not notifying) keeps the board's
  // save-on-change effect from feeding itself.
  if (readRaw(knownKey(raffleId)) === raw) return;
  writeRaw(knownKey(raffleId), raw);
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** The browser's own view of the connection; assumed online on the server. */
export function useBrowserOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
