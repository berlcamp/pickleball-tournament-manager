import type { Role } from "@/types";

export const MATCH_INTERVALS = [5, 10, 15, 20, 30] as const;

/**
 * How many teams advance from each group into the final stage. Read by finals
 * generation, group-stage standings highlighting and knockout slot reservation
 * alike — keep it here so those three can never disagree.
 */
export const ADVANCE_PER_GROUP = 2;

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  scorekeeper: "Scorekeeper",
  viewer: "Viewer",
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
