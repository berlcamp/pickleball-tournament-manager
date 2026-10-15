import type { CategoryFormat, Role } from "@/types";

export const MATCH_INTERVALS = [5, 10, 15, 20, 30] as const;

/**
 * How many teams advance from each group into the final stage. Read by finals
 * generation, group-stage standings highlighting and knockout slot reservation
 * alike — keep it here so those three can never disagree.
 */
export const ADVANCE_PER_GROUP = 2;

/**
 * The group counts a category can be drawn into. The finals cross over (each
 * group winner plays the mirror group's runner-up, see services/brackets.ts),
 * which fills a bracket with no byes only when the number of groups is a
 * power of two.
 */
export const GROUP_COUNTS = [1, 2, 4, 8, 16] as const;

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  scorekeeper: "Scorekeeper",
  viewer: "Viewer",
};

/** One-tap names offered when adding a category. */
export const CATEGORY_PRESETS = [
  "Men's Doubles",
  "Women's Doubles",
  "Mixed Doubles",
  "Men's Singles",
  "Women's Singles",
  "Open Doubles",
  "Novice Doubles",
  "Seniors Doubles",
];

export const FORMAT_LABELS: Record<CategoryFormat, string> = {
  doubles: "Doubles",
  singles: "Singles",
  blind_pairing: "Blind pairing",
};

/** Format plus who signs up, for pickers and cards. */
export const FORMAT_DESCRIPTIONS: Record<CategoryFormat, string> = {
  doubles: "Doubles · 2 players",
  singles: "Singles · 1 player",
  blind_pairing: "Blind pairing · 1 player, partner drawn",
};

// Permission ranking — higher can do everything a lower can.
const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  scorekeeper: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const STATUS_FLOW = [
  "draft",
  "group_stage",
  "final_stage",
  "completed",
] as const;
