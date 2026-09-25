"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawWinner, type DrawWinnerResult } from "@/actions/raffle";

// Easing: ease-out cubic — a stronger deceleration than quad. Most of the
// glide distance is covered early, so the tail slows hard and the final ~2
// seconds crawl to a near-stop before landing (dramatic reveal). Its initial
// slope is 3, matching the constant-phase velocity when the glide duration is
// sized to it below (factor 3), so the hand-off has no visible lurch.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export type SpinEngineConfig = {
  raffleId: string;
  sessionId: string;
  durationSeconds: number;
  spinsCount: number; // total rotations during the spin (e.g. 6 means ~6 full turns)
};

export type SpinEngineState = {
  angle: number; // current rotation angle in degrees
  spinning: boolean;
  landed: boolean; // true briefly after a spin completes — for confetti / pulse
};

export function useSpinEngine() {
  const [state, setState] = useState<SpinEngineState>({
    angle: 0,
    spinning: false,
    landed: false,
  });
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const prefersReducedMotion = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Performs one spin:
  //   1. Starts rotating the wheel at constant velocity immediately.
  //   2. In parallel, calls drawWinner() to fetch the persisted winner.
  //   3. Once the server responds, decelerates into a landing where paddle 0
  //      sits at the front (angle ≡ 0 mod 360).
  // Running the server call in parallel keeps the wheel visibly moving the
  // whole time, so chained spins flow into each other.
  const spin = useCallback(
    async (
      config: SpinEngineConfig,
      drawArgs: {
        departmentId?: string;
        prizeLabel?: string;
        excludedEntryIds: string[];
      },
      onTick?: (angle: number) => void,
      // Fires the moment the server-chosen winner is known (mid-spin). Lets the
      // caller stage the winner on the wheel before it lands, so the paddle
      // under the selector already shows the winner when it stops — no swap.
      onWinnerKnown?: (winner: DrawWinnerResult) => void,
    ): Promise<{ winner: DrawWinnerResult } | { error: string }> => {
      // Cancel any in-flight animation.
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      setState((s) => ({ ...s, spinning: true, landed: false }));

      const drawPromise = drawWinner({
        raffle_id: config.raffleId,
        session_id: config.sessionId,
        department_id: drawArgs.departmentId,
        prize_label: drawArgs.prizeLabel,
        excluded_entry_ids: drawArgs.excludedEntryIds,
      });

      // Reduced motion: skip animation, snap to landing once we have a winner.
      if (prefersReducedMotion()) {
        const result = await drawPromise;
        if (!result.ok || !result.data) {
          setState((s) => ({ ...s, spinning: false }));
          return { error: result.ok ? "Draw failed." : result.error };
        }
        const winner = result.data;
        onWinnerKnown?.(winner);
        const startAngle = angleRef.current;
        const rotations = Math.max(3, config.spinsCount);
        const target = Math.ceil((startAngle + rotations * 360) / 360) * 360;
        angleRef.current = target;
        setState({ angle: target, spinning: false, landed: true });
        onTick?.(target);
        setTimeout(() => setState((s) => ({ ...s, landed: false })), 1500);
        return { winner };
      }

      const totalDurationMs = Math.max(1000, config.durationSeconds * 1000);
      // How long the closing slowdown lasts. The wheel holds a steady, moderate
      // speed (names readable, not a blur) from the start through the middle,
      // and only glides to a stop once this much time remains at the tail.
      const decelWindowMs = 2500;
      // ~0.83 rotations per second — a calm, unhurried cruise (deliberately not
      // fast) so the start-through-middle reads as steady before the tail slows.
      const velocityDegPerSec = 300;

      const drawSlot: {
        value: { winner: DrawWinnerResult } | { error: string } | null;
      } = { value: null };
      drawPromise.then((res) => {
        if (!res.ok || !res.data) {
          drawSlot.value = { error: res.ok ? "Draw failed." : res.error };
          return;
        }
        drawSlot.value = { winner: res.data };
        // Stage the winner now, while the wheel is still decelerating, so it's
        // already on paddle 0 by the time the wheel comes to rest.
        onWinnerKnown?.(res.data);
      });

      const t0 = performance.now();
      let lastNow = t0;
      let phase: "constant" | "decel" = "constant";
      let decelStartAngle = 0;
      let decelTargetAngle = 0;
      let decelStartTime = 0;
      let decelDurationMs = 0;

      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          const dtSec = Math.max(0, (now - lastNow) / 1000);
          lastNow = now;

          if (phase === "constant") {
            const newAngle = angleRef.current + velocityDegPerSec * dtSec;
            angleRef.current = newAngle;
            setState((s) => ({ ...s, angle: newAngle }));
            onTick?.(newAngle);

            if (drawSlot.value) {
              if ("error" in drawSlot.value) {
                rafRef.current = null;
                resolve();
                return;
              }
              const elapsed = now - t0;
              // Keep the wheel at full speed (names streaming) until only the
              // decel window remains — this is what makes it read as a fast
              // spinning wheel that then slows, instead of a slow uniform grind
              // the whole way (the old bug: nearly the entire spin collapsed
              // into a crawl the moment the fast server responded).
              if (totalDurationMs - elapsed > decelWindowMs) {
                rafRef.current = requestAnimationFrame(tick);
                return;
              }
              // Glide ~1 rotation to a stop, landing on a whole rotation so
              // paddle 0 (the winner) rests under the selector. Fewer glide
              // rotations keeps the total spin sane now that the cruise is
              // slower (a slower speed stretches the cubic decel below).
              decelStartAngle = newAngle;
              decelTargetAngle = Math.ceil((newAngle + 1 * 360) / 360) * 360;
              const glideDistance = decelTargetAngle - newAngle;
              decelStartTime = now;
              // Factor 3 matches easeOutCubic's initial slope, so velocity is
              // continuous with the constant phase (no lurch). The cubic curve
              // then makes the last couple of seconds crawl to a stop.
              decelDurationMs = (3 * glideDistance * 1000) / velocityDegPerSec;
              phase = "decel";
            }
            rafRef.current = requestAnimationFrame(tick);
          } else {
            const elapsed = now - decelStartTime;
            const t = Math.min(1, elapsed / decelDurationMs);
            const eased = easeOutCubic(t);
            const angle = decelStartAngle + (decelTargetAngle - decelStartAngle) * eased;
            angleRef.current = angle;
            setState((s) => ({ ...s, angle }));
            onTick?.(angle);
            if (t < 1) {
              rafRef.current = requestAnimationFrame(tick);
            } else {
              rafRef.current = null;
              resolve();
            }
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });

      const finalResult = drawSlot.value;
      if (finalResult === null || "error" in finalResult) {
        setState((s) => ({ ...s, spinning: false }));
        return { error: finalResult?.error ?? "Draw failed." };
      }

      angleRef.current = decelTargetAngle;
      setState({ angle: decelTargetAngle, spinning: false, landed: true });
      setTimeout(() => setState((s) => ({ ...s, landed: false })), 1800);

      return { winner: finalResult.winner };
    },
    [prefersReducedMotion],
  );

  return { state, spin };
}
