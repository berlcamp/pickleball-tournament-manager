/**
 * Pure registration rules — no I/O, no framework imports (see AGENTS.md).
 * Both the public portal and the server action that accepts submissions decide
 * "is this category taking entries?" through `registrationAvailability`, so the
 * form and the write path can never disagree.
 */
import type { Category, CategoryFormat, RegistrationStatus } from "@/types";

export type ClosedReason =
  | "closed" // manager switched it off
  | "deadline_passed"
  | "full" // approved teams hit the cap
  | "stage_started"; // category left draft, brackets already exist

export type RegistrationAvailability =
  | { open: true }
  | { open: false; reason: ClosedReason };

/** Number of players a category collects. Blind pairing takes one player
 *  per registration — partners are drawn afterwards on the Teams tab. */
export function playersPerTeam(format: CategoryFormat): number {
  return format === "doubles" ? 2 : 1;
}

/** Whether the fee is charged per player rather than per team. */
export function feeUnit(format: CategoryFormat): "player" | "team" {
  return format === "blind_pairing" ? "player" : "team";
}

/** Price of the optional tournament shirt, charged per player (₱). */
export const SHIRT_PRICE = 400;

/**
 * What a team owes: the category's per-team fee, plus a shirt for every
 * player when they opted in. The form shows this and the server stores it as
 * the registration's `fee_amount`, so both read it from here.
 */
export function registrationTotal(
  fee: number,
  players: number,
  includeShirt: boolean,
): number {
  return fee + (includeShirt ? SHIRT_PRICE * players : 0);
}

/**
 * Whether `category` is currently accepting entries.
 *
 * `approvedCount` counts APPROVED teams only — pending entries do not consume
 * a slot, so a manager can over-collect and pick.
 */
export function registrationAvailability(
  category: Pick<
    Category,
    | "registration_open"
    | "registration_deadline"
    | "max_teams"
    | "status"
  >,
  approvedCount: number,
  now: Date = new Date(),
): RegistrationAvailability {
  if (!category.registration_open) return { open: false, reason: "closed" };
  if (category.status !== "draft") {
    return { open: false, reason: "stage_started" };
  }
  if (category.registration_deadline) {
    const deadline = new Date(category.registration_deadline);
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() <= now.getTime()) {
      return { open: false, reason: "deadline_passed" };
    }
  }
  if (category.max_teams !== null && approvedCount >= category.max_teams) {
    return { open: false, reason: "full" };
  }
  return { open: true };
}

export const CLOSED_MESSAGES: Record<ClosedReason, string> = {
  closed: "Registration for this category is not open yet.",
  deadline_passed: "The registration deadline for this category has passed.",
  full: "This category is full — all team slots have been taken.",
  stage_started:
    "This category has already started, so it is no longer accepting entries.",
};

/** A team occupies a slot in the bracket only once it has been approved. */
export function consumesSlot(status: RegistrationStatus): boolean {
  return status === "approved";
}

/** Slots left, or null when the category is uncapped. */
export function slotsRemaining(
  maxTeams: number | null,
  approvedCount: number,
): number | null {
  if (maxTeams === null) return null;
  return Math.max(0, maxTeams - approvedCount);
}
