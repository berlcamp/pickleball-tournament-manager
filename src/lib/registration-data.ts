import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  Category,
  Registration,
  RegistrationPlayer,
  Tournament,
} from "@/types";
import { normalizeReferenceCode } from "@/lib/registration-code";

export const REGISTRATION_BUCKET = "pickleball-registrations";

/** Signed-URL lifetime for ID photos and receipts. Long enough to render a
 * page, short enough that a leaked link goes stale quickly. */
const SIGNED_URL_TTL = 60 * 10;

/**
 * Registrations hold phone numbers, government IDs and payment receipts, so
 * the tables carry no anon RLS read policy at all. Every public read and write
 * goes through the service-role client instead — which means the key is
 * required, not optional, for this module.
 */
export function registrationsEnabled(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function registrationClient(): SupabaseClient<Database> {
  if (!registrationsEnabled()) {
    // Deliberately vague: this can surface in a public-facing action result.
    // The dashboard names the missing variable for the organizer instead.
    throw new Error(
      "Registration is not available right now. Please contact the organizer.",
    );
  }
  return createServiceClient();
}

/** Mint a short-lived signed URL for a private upload. Returns null for a
 * missing path or an object that has since been deleted. */
export async function signedUploadUrl(
  db: SupabaseClient<Database>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage
    .from(REGISTRATION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

export type RegistrationPlayerView = RegistrationPlayer & {
  /** Short-lived signed URL, or null when no ID was uploaded. */
  id_photo_url: string | null;
};

export type RegistrationView = Registration & {
  players: RegistrationPlayerView[];
  payment_proof_url: string | null;
};

async function attachFiles(
  db: SupabaseClient<Database>,
  registration: Registration,
  players: RegistrationPlayer[],
): Promise<RegistrationView> {
  const [proofUrl, playerUrls] = await Promise.all([
    signedUploadUrl(db, registration.payment_proof_path),
    Promise.all(players.map((p) => signedUploadUrl(db, p.id_photo_path))),
  ]);
  return {
    ...registration,
    payment_proof_url: proofUrl,
    players: players.map((p, i) => ({ ...p, id_photo_url: playerUrls[i] })),
  };
}

async function loadPlayers(
  db: SupabaseClient<Database>,
  registrationIds: string[],
): Promise<Map<string, RegistrationPlayer[]>> {
  const byRegistration = new Map<string, RegistrationPlayer[]>();
  if (registrationIds.length === 0) return byRegistration;
  const { data } = await db
    .from("registration_players")
    .select("*")
    .in("registration_id", registrationIds)
    .order("position");
  for (const row of (data ?? []) as RegistrationPlayer[]) {
    const list = byRegistration.get(row.registration_id) ?? [];
    list.push(row);
    byRegistration.set(row.registration_id, list);
  }
  return byRegistration;
}

export type RegistrationStatusView = {
  registration: RegistrationView;
  category: Category;
  tournament: Tournament;
};

/**
 * Look up a registration from a reference code for the public status page.
 * The code is the credential, so an unknown or malformed code returns null
 * rather than leaking whether a similar code exists.
 */
export async function getRegistrationByCode(
  rawCode: string,
): Promise<RegistrationStatusView | null> {
  const code = normalizeReferenceCode(rawCode);
  if (!code) return null;

  const db = registrationClient();
  const { data: registration } = await db
    .from("registrations")
    .select("*")
    .eq("reference_code", code)
    .maybeSingle();
  if (!registration) return null;

  const [{ data: category }, { data: tournament }, players] = await Promise.all([
    db
      .from("categories")
      .select("*")
      .eq("id", registration.category_id)
      .maybeSingle(),
    db
      .from("tournaments")
      .select("*")
      .eq("id", registration.tournament_id)
      .maybeSingle(),
    loadPlayers(db, [registration.id]),
  ]);
  if (!category || !tournament) return null;

  return {
    registration: await attachFiles(
      db,
      registration as Registration,
      players.get(registration.id) ?? [],
    ),
    category: category as Category,
    tournament: tournament as Tournament,
  };
}

/** Approved-team counts per category, used for cap/slot display. */
export async function approvedCountsByCategory(
  tournamentId: string,
): Promise<Map<string, number>> {
  const db = registrationClient();
  const { data } = await db
    .from("registrations")
    .select("category_id")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved");
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

/** Full registration list for the manager's dashboard, newest first. */
export async function listRegistrations(
  tournamentId: string,
): Promise<RegistrationView[]> {
  const db = registrationClient();
  const { data } = await db
    .from("registrations")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Registration[];
  const players = await loadPlayers(
    db,
    rows.map((r) => r.id),
  );
  return Promise.all(
    rows.map((r) => attachFiles(db, r, players.get(r.id) ?? [])),
  );
}
