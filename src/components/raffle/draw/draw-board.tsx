"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CloudOff,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Settings,
  Square,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DESIGNATION_TEASE_MS,
  WaterwheelSpinner,
  type SpinnerEntry,
} from "./waterwheel-spinner";
import { WinnersPanel } from "./winners-panel";
import { SettingsDialog, type DrawSettings } from "./settings-dialog";
import { useSpinEngine, type DrawOutcome } from "./use-spin-engine";
import {
  addPendingWinner,
  readPendingWinners,
  removePendingWinners,
  saveKnownWinners,
  useBrowserOnline,
  useKnownWinners,
  usePendingWinners,
  type PendingWinner,
} from "./offline-store";
import {
  drawWinner,
  getRaffleWinners,
  syncOfflineWinners,
  type DrawWinnerResult,
} from "@/actions/raffle";

type Entry = {
  id: string;
  name: string;
  designation: string | null;
  department_id: string;
};
type Department = { id: string; name: string; entry_count: number };

interface Props {
  raffle: { id: string; name: string };
  departments: Department[];
  entries: Entry[];
  initialWinners?: DrawWinnerResult[];
}

const DEFAULT_SETTINGS: DrawSettings = {
  totalWinners: 5,
  spinDurationSeconds: 5,
  departmentId: "ALL",
  prizeLabel: "",
  autoSpin: false,
  autoSpinIntervalSeconds: 3,
  designationSuspense: false,
};

// Picked once per page load. Module scope, not render, so rendering stays pure.
const CLIENT_SHUFFLE_SEED =
  typeof window === "undefined" ? 0 : Math.floor(Math.random() * 2 ** 31) + 1;

function subscribeNothing() {
  return () => {};
}

/** Appends each winner not already in the list, by id. */
function mergeWinners(...lists: DrawWinnerResult[][]): DrawWinnerResult[] {
  const seen = new Set<string>();
  const out: DrawWinnerResult[] = [];
  for (const list of lists) {
    for (const w of list) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      out.push(w);
    }
  }
  return out;
}

/** Unbiased index in [0, n) from the browser's CSPRNG. */
function randomIndex(n: number): number {
  const limit = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % n;
}

// How often a board with queued offline winners retries the connection.
const SYNC_RETRY_MS = 20_000;

/** Fisher–Yates driven by mulberry32, so a given seed always gives one order. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let a = seed;
  const random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function DrawBoard({
  raffle,
  departments,
  entries,
  initialWinners = [],
}: Props) {
  // Rotated on "New draw" so each visible draw run starts at draw_index=1 and
  // has a clean local winners list.
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_SETTINGS);
  // Winners the server has told us about, plus every draw made on this page.
  const [drawnWinners, setDrawnWinners] = useState<DrawWinnerResult[]>(initialWinners);
  // Offline mode. The browser's own flag covers a dropped network; a failed
  // server call (connected to Wi-Fi with no internet behind it) or the
  // operator's toggle sets `forcedOffline`.
  const browserOnline = useBrowserOnline();
  const [forcedOffline, setForcedOffline] = useState(false);
  const offline = !browserOnline || forcedOffline;
  const pendingWinners = usePendingWinners(raffle.id);
  const knownWinners = useKnownWinners(raffle.id);
  // Until the server confirms the winners list, the page may be a cached copy
  // (reloaded offline), so the device's remembered list is folded in too.
  const [serverConfirmed, setServerConfirmed] = useState(false);
  // All winners for this raffle. Drives pool exclusion so prior winners can
  // never be drawn again until an admin runs "Clear winners".
  const winners = useMemo(
    () =>
      mergeWinners(
        drawnWinners,
        pendingWinners,
        serverConfirmed ? [] : knownWinners,
      ),
    [drawnWinners, pendingWinners, knownWinners, serverConfirmed],
  );
  const [winnerForWheel, setWinnerForWheel] = useState<SpinnerEntry | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoSpinPending, setAutoSpinPending] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  // `settings.totalWinners` is treated as a *batch* size, not a session cap.
  const [batchStartCount, setBatchStartCount] = useState(0);
  const autoSpinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Winners whose name hasn't been revealed on the wheel yet — hidden from the
  // sidebar until the designation tease finishes so the wheel announces first.
  const [hiddenWinnerIds, setHiddenWinnerIds] = useState<Set<string>>(() => new Set());
  // Drives the sidebar's "just landed" confetti.
  const [sidebarLanded, setSidebarLanded] = useState(false);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sidebarLandedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { state: engine, spin } = useSpinEngine();

  const clearAutoSpinTimer = useCallback(() => {
    if (autoSpinTimerRef.current !== null) {
      clearTimeout(autoSpinTimerRef.current);
      autoSpinTimerRef.current = null;
    }
    setAutoSpinPending(false);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSpinTimerRef.current !== null) {
        clearTimeout(autoSpinTimerRef.current);
      }
      revealTimersRef.current.forEach((t) => clearTimeout(t));
      revealTimersRef.current = [];
      if (sidebarLandedTimerRef.current !== null) {
        clearTimeout(sidebarLandedTimerRef.current);
      }
    };
  }, []);

  const flashSidebarLanded = useCallback(() => {
    if (sidebarLandedTimerRef.current !== null) {
      clearTimeout(sidebarLandedTimerRef.current);
    }
    setSidebarLanded(true);
    sidebarLandedTimerRef.current = setTimeout(() => {
      setSidebarLanded(false);
      sidebarLandedTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Remember the full list so a reload without internet still excludes them.
  useEffect(() => {
    saveKnownWinners(raffle.id, winners);
  }, [raffle.id, winners]);

  // Writes queued offline winners to the server, then refreshes the winners
  // list from it. Throws only when the network is still down.
  const reconnect = useCallback(async () => {
    const queue = readPendingWinners(raffle.id);
    if (queue.length > 0) {
      const res = await syncOfflineWinners({
        raffle_id: raffle.id,
        winners: queue.map((w) => ({
          id: w.id,
          entry_id: w.entry_id,
          entry_name: w.entry_name,
          entry_designation: w.entry_designation,
          department_name: w.department_name,
          prize_label: w.prize_label,
          session_id: w.session_id,
          draw_index: w.draw_index,
          drawn_at: w.drawn_at,
        })),
      });
      if (!res.ok || !res.data) {
        toast.error("Couldn't upload offline winners", {
          id: "raffle-offline-sync",
          description: res.ok ? undefined : res.error,
        });
        return;
      }
      const { synced, dropped } = res.data;
      const syncedIds = new Set(synced);
      setDrawnWinners((prev) =>
        mergeWinners(prev, queue.filter((w) => syncedIds.has(w.id))),
      );
      removePendingWinners(raffle.id, [...synced, ...dropped]);
      if (synced.length > 0) {
        toast.success(
          `Uploaded ${synced.length} winner${synced.length === 1 ? "" : "s"} drawn offline`,
        );
      }
      if (dropped.length > 0) {
        toast.warning(
          `${dropped.length} offline winner${dropped.length === 1 ? " was" : "s were"} not saved — the entry was deleted from the raffle.`,
        );
      }
    }

    const fresh = await getRaffleWinners(raffle.id);
    if (!fresh.ok || !fresh.data) return;
    const serverWinners = fresh.data;
    setDrawnWinners((prev) =>
      mergeWinners(
        serverWinners
          .slice()
          .sort((a, b) => a.draw_index - b.draw_index)
          .map((w) => ({
            id: w.id,
            entry_id: w.entry_id,
            entry_name: w.entry_name,
            entry_designation: w.entry_designation,
            department_id: w.department_id,
            department_name: w.department_name,
            draw_index: w.draw_index,
            session_id: w.session_id,
          })),
        prev,
      ),
    );
    setServerConfirmed(true);
    setForcedOffline(false);
  }, [raffle.id]);

  // Reach the server on load and whenever the browser comes back online, then
  // keep retrying while offline winners are waiting to be uploaded.
  const needsServer = !serverConfirmed || pendingWinners.length > 0;
  useEffect(() => {
    if (!browserOnline || !needsServer) return;
    const attempt = () => void reconnect().catch(() => {});
    attempt();
    const timer = setInterval(attempt, SYNC_RETRY_MS);
    return () => clearInterval(timer);
  }, [browserOnline, needsServer, reconnect]);

  // The service worker keeps a copy of this page and its scripts so it can be
  // reopened with no connection. Production only — in dev it would cache
  // stale bundles.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/raffle-sw.js", { scope: "/raffle-draw/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Files this page loaded before the worker took control.
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(`${location.origin}/_next/static/`));
        reg.active?.postMessage({ type: "precache", urls: [location.href, ...urls] });
      })
      .catch(() => {});
  }, []);

  const eligibleEntries = useMemo(() => {
    const wonIds = new Set(winners.map((w) => w.entry_id));
    return entries.filter((e) => {
      if (wonIds.has(e.id)) return false;
      if (settings.departmentId !== "ALL" && e.department_id !== settings.departmentId)
        return false;
      return true;
    });
  }, [entries, winners, settings.departmentId]);

  // Deterministic order used for SSR + the first client render so the server
  // and client HTML match (no hydration mismatch).
  const baseSpinnerEntries = useMemo<SpinnerEntry[]>(
    () => eligibleEntries.map((e) => ({ name: e.name, designation: e.designation })),
    [eligibleEntries],
  );
  // Shuffle the pool for the wheel so repeated or clustered names (duplicate
  // tickets, names added in blocks) don't appear grouped as it spins. The seed
  // is 0 (no shuffle) on the server and during hydration, then the page-load
  // seed on the client, so the HTML matches and the reorder happens while the
  // wheel is still static. Display-only — the winner is chosen server-side,
  // independent of this order.
  const shuffleSeed = useSyncExternalStore(
    subscribeNothing,
    () => CLIENT_SHUFFLE_SEED,
    () => 0,
  );
  const eligibleSpinnerEntries = useMemo(
    () =>
      shuffleSeed === 0
        ? baseSpinnerEntries
        : seededShuffle(baseSpinnerEntries, shuffleSeed),
    [baseSpinnerEntries, shuffleSeed],
  );

  // Visible "this draw" list — filtered to the current session. Built from
  // `drawnWinners`, which only gains a draw once its spin has landed; the
  // offline queue holds a winner from the moment it is picked, which would put
  // it in the sidebar while the wheel is still turning.
  const sessionWinners = useMemo(
    () => drawnWinners.filter((w) => w.session_id === sessionId),
    [drawnWinners, sessionId],
  );
  // What the sidebar actually renders — drops winners still mid-tease.
  const visibleSessionWinners = useMemo(
    () => sessionWinners.filter((w) => !hiddenWinnerIds.has(w.id)),
    [sessionWinners, hiddenWinnerIds],
  );

  const drawnInBatch = Math.max(0, sessionWinners.length - batchStartCount);
  const batchComplete = drawnInBatch >= settings.totalWinners;
  const poolEmpty = eligibleEntries.length === 0;
  // Goal-already-reached no longer disables Spin — the next click starts a new
  // batch. Only the pool / spinning state can block.
  const canSpin = !engine.spinning && !poolEmpty;
  const disabledReason = engine.spinning
    ? null
    : poolEmpty
      ? settings.departmentId === "ALL"
        ? "No eligible entries left in the pool."
        : "No eligible entries for this department."
      : null;

  // Lets the auto-spin timer call the latest onSpin rather than the one it
  // was scheduled from.
  const onSpinRef = useRef<(() => Promise<void>) | null>(null);

  const onSpin = useCallback(async () => {
    if (!canSpin) return;

    setAutoSpinPending(false);
    if (autoSpinTimerRef.current !== null) {
      clearTimeout(autoSpinTimerRef.current);
      autoSpinTimerRef.current = null;
    }

    // If the previous batch already met its goal, this Spin starts a new batch.
    const effectiveBatchStart = batchComplete ? sessionWinners.length : batchStartCount;
    if (effectiveBatchStart !== batchStartCount) {
      setBatchStartCount(effectiveBatchStart);
    }

    // Clear the previous winner-on-wheel so the new spin streams names again.
    setWinnerForWheel(null);

    // Picks from the pool on this device and queues the winner for upload.
    const drawLocally = (): DrawOutcome => {
      if (eligibleEntries.length === 0) {
        return { ok: false, error: "No eligible entries to draw." };
      }
      const pick = eligibleEntries[randomIndex(eligibleEntries.length)];
      const winner: PendingWinner = {
        id: crypto.randomUUID(),
        raffle_id: raffle.id,
        entry_id: pick.id,
        entry_name: pick.name,
        entry_designation: pick.designation ?? null,
        department_id: pick.department_id,
        department_name:
          departments.find((d) => d.id === pick.department_id)?.name ?? "—",
        prize_label: settings.prizeLabel.trim() || null,
        session_id: sessionId,
        draw_index: Math.max(0, ...sessionWinners.map((w) => w.draw_index)) + 1,
        drawn_at: new Date().toISOString(),
      };
      addPendingWinner(raffle.id, winner);
      return { ok: true, data: winner };
    };

    const draw = async (): Promise<DrawOutcome> => {
      if (offline) return drawLocally();
      try {
        // Upload anything drawn offline first so the server numbers this
        // draw after them.
        if (readPendingWinners(raffle.id).length > 0) await reconnect();
        const res = await drawWinner({
          raffle_id: raffle.id,
          session_id: sessionId,
          department_id:
            settings.departmentId === "ALL" ? undefined : settings.departmentId,
          prize_label: settings.prizeLabel.trim() || undefined,
          excluded_entry_ids: winners.map((w) => w.entry_id),
        });
        if (!res.ok) return res;
        return res.data ? { ok: true, data: res.data } : { ok: false, error: "Draw failed." };
      } catch {
        // The request never reached the server — carry on offline.
        setForcedOffline(true);
        toast.warning("Connection lost — drawing offline", {
          description: "Winners are saved on this device and uploaded when you're back online.",
        });
        return drawLocally();
      }
    };

    const result = await spin(
      {
        durationSeconds: settings.spinDurationSeconds,
        spinsCount: 6,
      },
      draw,
      undefined,
      // Stage the winner on paddle 0 on the final half-turn, while it is out
      // of sight, so it holds the winner when the wheel lands — the name
      // under the selector matches the announced winner, with no swap.
      (winner) =>
        setWinnerForWheel({
          name: winner.entry_name,
          designation: winner.entry_designation,
        }),
    );

    if ("error" in result) {
      toast.error("Draw failed", { description: result.error });
      return;
    }

    setDrawnWinners((prev) => mergeWinners(prev, [result.winner]));

    const winnerHasDesignation = !!result.winner.entry_designation?.trim();
    if (settings.designationSuspense && winnerHasDesignation) {
      const winnerId = result.winner.id;
      setHiddenWinnerIds((prev) => {
        const next = new Set(prev);
        next.add(winnerId);
        return next;
      });
      const t = setTimeout(() => {
        setHiddenWinnerIds((prev) => {
          if (!prev.has(winnerId)) return prev;
          const next = new Set(prev);
          next.delete(winnerId);
          return next;
        });
        flashSidebarLanded();
        revealTimersRef.current = revealTimersRef.current.filter((timer) => timer !== t);
      }, DESIGNATION_TEASE_MS);
      revealTimersRef.current.push(t);
    } else {
      flashSidebarLanded();
    }

    const nextDrawnInBatch = sessionWinners.length + 1 - effectiveBatchStart;
    const moreNeeded = nextDrawnInBatch < settings.totalWinners;
    const poolHasMore = eligibleEntries.length - 1 > 0;
    if (settings.autoSpin && settings.totalWinners > 1 && moreNeeded && poolHasMore) {
      setAutoSpinPending(true);
      const delayMs = Math.max(1, settings.autoSpinIntervalSeconds) * 1000;
      autoSpinTimerRef.current = setTimeout(() => {
        autoSpinTimerRef.current = null;
        setAutoSpinPending(false);
        void onSpinRef.current?.();
      }, delayMs);
    }
  }, [
    canSpin,
    spin,
    raffle.id,
    sessionId,
    settings,
    winners,
    offline,
    reconnect,
    departments,
    eligibleEntries,
    sessionWinners,
    batchStartCount,
    batchComplete,
    flashSidebarLanded,
  ]);

  const resetDraw = useCallback(() => {
    clearAutoSpinTimer();
    revealTimersRef.current.forEach((t) => clearTimeout(t));
    revealTimersRef.current = [];
    if (sidebarLandedTimerRef.current !== null) {
      clearTimeout(sidebarLandedTimerRef.current);
      sidebarLandedTimerRef.current = null;
    }
    setHiddenWinnerIds(new Set());
    setSidebarLanded(false);
    setWinnerForWheel(null);
    setBatchStartCount(0);
    setSessionId(crypto.randomUUID());
    setResetConfirmOpen(false);
  }, [clearAutoSpinTimer]);

  function requestReset() {
    if (sessionWinners.length === 0) {
      resetDraw();
    } else {
      setResetConfirmOpen(true);
    }
  }

  useEffect(() => {
    onSpinRef.current = onSpin;
  }, [onSpin]);

  function changeSettings(next: DrawSettings) {
    // Turning auto-spin off cancels a spin that is already queued.
    if (!next.autoSpin) clearAutoSpinTimer();
    setSettings(next);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  function closeWindow() {
    window.close();
  }

  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden text-white">
      {/* page-wide background atmospherics */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[700px] -translate-x-1/2 rounded-full"
        style={{
          background: "radial-gradient(closest-side, rgba(245,197,38,0.16), transparent 70%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-[#f5c526]" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-[#f5c526]" />

      {/* ───────────────────── banner ───────────────────── */}
      <header className="relative z-10 flex items-start justify-between gap-4 px-8 pt-6">
        <div className="flex items-center gap-4">
          <span
            className="grid size-12 place-items-center rounded-md border border-white/15 bg-white/[0.04] text-[22px] font-medium text-[#f5c526]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
            aria-hidden
          >
            P
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">
              PicklePro by Sortbrite · Electronic Raffle Draw
            </span>
            <h1 className="text-3xl leading-tight" style={{ fontFamily: "var(--font-fraunces), serif" }}>
              <span className="text-white">{raffle.name}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => browserOnline && setForcedOffline((v) => !v)}
            disabled={!browserOnline}
            className={[
              "flex h-9 items-center gap-2 rounded-md border px-3 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
              offline
                ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                : "border-white/15 bg-white/[0.04] text-white/60 hover:bg-white/10",
            ].join(" ")}
            title={
              !browserOnline
                ? "No connection. Draws are saved on this device and uploaded when it returns."
                : forcedOffline
                  ? "Drawing offline. Click to go back online."
                  : "Connected. Click to draw offline."
            }
          >
            {offline ? <CloudOff className="size-3.5" /> : <Wifi className="size-3.5" />}
            {offline ? "Offline" : "Online"}
            {pendingWinners.length > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 text-[#0a1740]">
                {pendingWinners.length} to upload
              </span>
            )}
          </button>
          <SettingsDialog
            settings={settings}
            onChange={changeSettings}
            departments={departments}
            trigger={
              <Button
                size="icon"
                variant="outline"
                className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="size-4" />
              </Button>
            }
          />
          <Button
            size="icon"
            variant="outline"
            className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
            onClick={requestReset}
            aria-label="New draw"
            title="New draw (clear stage, keep history)"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
            onClick={closeWindow}
            aria-label="Close"
            title="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* ───────────────────── stage ───────────────────── */}
      <main className="relative z-10 mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 gap-6 px-8 pb-8 pt-6 lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-sm">
          <WaterwheelSpinner
            angle={engine.angle}
            entries={eligibleSpinnerEntries}
            // `winnerForWheel` is null while names stream past and is set on
            // the final half-turn of the slowdown, while paddle 0 is on the
            // hidden back of the wheel, so the winner comes round once and
            // rests under the selector. Setting it at rest instead would swap
            // the name in visibly.
            winner={winnerForWheel}
            spinning={engine.spinning}
            suspense={settings.designationSuspense}
          />

          {/* SPIN button */}
          <div className="flex w-full flex-col items-center gap-3">
            {autoSpinPending ? (
              <Button
                onClick={clearAutoSpinTimer}
                className="group h-16 min-w-[260px] gap-3 rounded-full border-2 border-red-300/60 bg-gradient-to-r from-red-500 to-red-600 text-xl font-semibold text-white shadow-[0_0_40px_rgba(239,68,68,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                <Square className="size-5 fill-current" />
                Pause auto-spin
              </Button>
            ) : (
              <Button
                onClick={onSpin}
                disabled={!canSpin}
                className="group h-16 min-w-[260px] gap-3 rounded-full border-2 border-amber-300/60 bg-gradient-to-r from-amber-400 to-amber-500 text-xl font-semibold text-[#0a1740] shadow-[0_0_40px_rgba(245,197,38,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                <Play className="size-6 fill-current" />
                {engine.spinning ? "Spinning…" : "Spin"}
              </Button>
            )}

            <p className="text-xs text-white/45">
              {disabledReason
                ? disabledReason
                : autoSpinPending
                  ? `Next spin in ~${settings.autoSpinIntervalSeconds.toFixed(1)}s · ${drawnInBatch} of ${settings.totalWinners} drawn · ${sessionWinners.length} total.`
                  : batchComplete
                    ? `Batch of ${settings.totalWinners} complete · ${sessionWinners.length} total. Click Spin to draw another ${settings.totalWinners}.`
                    : settings.autoSpin && settings.totalWinners > 1
                      ? `Auto-spin on · ${drawnInBatch} of ${settings.totalWinners} drawn · ${sessionWinners.length} total.`
                      : `${drawnInBatch} of ${settings.totalWinners} drawn · ${sessionWinners.length} total.`}
            </p>
          </div>
        </section>

        <WinnersPanel winners={visibleSessionWinners} landed={sidebarLanded} />
      </main>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new draw?</DialogTitle>
            <DialogDescription>
              This clears the {sessionWinners.length} winner
              {sessionWinners.length === 1 ? "" : "s"} on screen and starts a
              fresh draw. The dashboard winners list is unchanged, and anyone who
              already won stays excluded from the pool.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={resetDraw}>
              <RotateCcw className="size-4" />
              Start new draw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
