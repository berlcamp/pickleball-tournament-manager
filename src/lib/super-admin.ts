import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";

/**
 * PicklePro's system-wide administrator(s), matched by account email.
 *
 * This is deliberately NOT part of the tournament role ladder in
 * `lib/constants.ts` — those roles are granted per tournament by its owner,
 * while this one spans the whole install and nobody can hand it out from the
 * UI. It only ever unlocks read-only screens; every mutation still goes
 * through `assertRole`, so a super admin who isn't a member of a tournament
 * cannot change it.
 */
export const SUPER_ADMIN_EMAILS = ["berlcamp@gmail.com"];

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Gate a page on the super admin. Anyone else gets a 404 rather than a
 * "forbidden" — the screen shouldn't advertise that it exists.
 */
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!isSuperAdmin(user.email)) notFound();
  return user;
}
