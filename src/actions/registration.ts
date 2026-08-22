"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ActionError, assertRole, logAudit, run } from "./helpers";
import {
  categoryRegistrationSchema,
  paymentSettingsSchema,
  publicRegistrationSchema,
  registrationDecisionSchema,
  paymentDecisionSchema,
} from "@/validators/registration";
import {
  REGISTRATION_BUCKET,
  registrationClient,
  registrationsEnabled,
} from "@/lib/registration-data";
import {
  deriveTeamName,
  generateReferenceCode,
  normalizeReferenceCode,
} from "@/lib/registration-code";
import {
  CLOSED_MESSAGES,
  playersPerTeam,
  registrationAvailability,
} from "@/services/registration";
import type { Database } from "@/types/database";
import type { Category, Registration, RegistrationStatus } from "@/types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
/** Submissions allowed from one IP per hour. */
const IP_HOURLY_LIMIT = 8;

// ---------------------------------------------------------------------------
// Public submission
// ---------------------------------------------------------------------------

/** Validate an uploaded image before it ever reaches storage. */
function assertValidImage(file: File, label: string) {
  if (file.size === 0) throw new ActionError(`${label} is empty.`);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ActionError(`${label} must be 5MB or smaller.`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ActionError(`${label} must be a JPG, PNG or WEBP image.`);
  }
}

function fileFrom(form: FormData, key: string): File | null {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

async function uploadImage(
  db: SupabaseClient<Database>,
  file: File,
  path: string,
): Promise<string> {
  const { error } = await db.storage
    .from(REGISTRATION_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new ActionError(`Upload failed: ${error.message}`);
  return path;
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1] ?? "jpg";
}

/** Reserve a reference code, retrying on the (astronomically unlikely) clash. */
async function insertWithUniqueCode(
  db: SupabaseClient<Database>,
  row: Omit<Registration, "id" | "created_at" | "updated_at" | "reference_code">,
): Promise<Registration> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference_code = generateReferenceCode();
    const { data, error } = await db
      .from("registrations")
      .insert({ ...row, reference_code })
      .select("*")
      .single();
    if (!error) return data as Registration;
    // 23505 = unique_violation on reference_code; anything else is fatal.
    if ((error as { code?: string }).code !== "23505") {
      throw new ActionError(error.message);
    }
  }
  throw new ActionError("Could not generate a reference code. Please retry.");
}

/**
 * Accept a public registration. Called with FormData because it carries ID
 * photos and a payment receipt alongside the JSON payload.
 *
 * Which fields are *required* depends on the category's settings, so those
 * rules are enforced here rather than in the Zod schema.
 */
export async function submitRegistration(form: FormData) {
  return run(async () => {
    if (!registrationsEnabled()) {
      throw new ActionError(
        "Online registration is not available right now. Please contact the organizer.",
      );
    }

    // A bot that fills the hidden field gets a plausible-looking success with
    // no row written; a real browser never touches it.
    if ((form.get("website") as string | null)?.trim()) {
      throw new ActionError("Submission rejected.");
    }

    const payload = publicRegistrationSchema.parse(
      JSON.parse((form.get("payload") as string) ?? "{}"),
    );
    const db = registrationClient();

    const { data: categoryRow, error: categoryError } = await db
      .from("categories")
      .select("*")
      .eq("id", payload.category_id)
      .maybeSingle();
    if (categoryError) throw new ActionError(categoryError.message);
    if (!categoryRow) throw new ActionError("Category not found.");
    const category = categoryRow as Category;

    // ----- window / capacity ------------------------------------------------
    const { count: approvedCount } = await db
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("category_id", category.id)
      .eq("status", "approved");

    const availability = registrationAvailability(
      category,
      approvedCount ?? 0,
    );
    if (!availability.open) {
      throw new ActionError(CLOSED_MESSAGES[availability.reason]);
    }

    // ----- rate limit -------------------------------------------------------
    const ip = await clientIp();
    if (ip) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recent } = await db
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("submitted_ip", ip)
        .gte("created_at", since);
      if ((recent ?? 0) >= IP_HOURLY_LIMIT) {
        throw new ActionError(
          "Too many registrations from this device. Please try again later.",
        );
      }
    }

    // ----- shape against the category's settings ----------------------------
    const expectedPlayers = playersPerTeam(category.format);
    if (payload.players.length !== expectedPlayers) {
      throw new ActionError(
        expectedPlayers === 1
          ? "This is a singles category — enter one player."
          : "This is a doubles category — enter both players.",
      );
    }
    if (category.collect_shirt_sizes) {
      if (payload.players.some((p) => !p.shirt_size)) {
        throw new ActionError("Choose a t-shirt size for every player.");
      }
    }

    const idPhotos = payload.players.map((_, i) => fileFrom(form, `id_photo_${i}`));
    if (category.require_player_id) {
      idPhotos.forEach((file, i) => {
        if (!file) {
          throw new ActionError(
            `Upload a valid ID for player ${i + 1}.`,
          );
        }
      });
    }
    idPhotos.forEach((file, i) => {
      if (file) assertValidImage(file, `Player ${i + 1}'s ID`);
    });

    const proof = fileFrom(form, "payment_proof");
    const feeDue = Number(category.registration_fee) > 0;
    if (category.require_payment_upfront && feeDue && !proof) {
      throw new ActionError("Upload your proof of payment to continue.");
    }
    if (proof) assertValidImage(proof, "Proof of payment");

    // ----- duplicate guard --------------------------------------------------
    const { data: existing } = await db
      .from("registrations")
      .select("id, contact_number")
      .eq("category_id", category.id)
      .in("status", ["pending", "approved"]);
    const digits = (v: string) => v.replace(/\D/g, "");
    if (
      (existing ?? []).some(
        (r) => digits(r.contact_number) === digits(payload.contact_number),
      )
    ) {
      throw new ActionError(
        "This contact number already has a registration in this category. Use your reference link to check its status.",
      );
    }

    // ----- write ------------------------------------------------------------
    const teamName = deriveTeamName(payload.players.map((p) => p.full_name));
    const registration = await insertWithUniqueCode(db, {
      tournament_id: category.tournament_id,
      category_id: category.id,
      team_name: teamName,
      contact_number: payload.contact_number.trim(),
      contact_email: payload.contact_email?.trim() || null,
      status: "pending",
      payment_status: proof ? "submitted" : "unpaid",
      fee_amount: Number(category.registration_fee),
      payment_reference: payload.payment_reference?.trim() || null,
      payment_proof_path: null,
      payment_submitted_at: proof ? new Date().toISOString() : null,
      admin_note: null,
      participant_id: null,
      submitted_ip: ip,
      decided_at: null,
      decided_by: null,
    });

    // Files are uploaded under the new row's id, then linked back. If any part
    // fails the whole registration is rolled back so a team never ends up
    // half-submitted (the cascade clears the player rows too).
    try {
      const playerRows = await Promise.all(
        payload.players.map(async (player, i) => {
          const file = idPhotos[i];
          const path = file
            ? await uploadImage(
                db,
                file,
                `${registration.id}/id-${i + 1}.${extensionFor(file)}`,
              )
            : null;
          return {
            registration_id: registration.id,
            position: i + 1,
            full_name: player.full_name.trim(),
            shirt_size: player.shirt_size ?? null,
            id_photo_path: path,
          };
        }),
      );
      const { error: playerError } = await db
        .from("registration_players")
        .insert(playerRows);
      if (playerError) throw new ActionError(playerError.message);

      if (proof) {
        const path = await uploadImage(
          db,
          proof,
          `${registration.id}/payment.${extensionFor(proof)}`,
        );
        const { error: updateError } = await db
          .from("registrations")
          .update({ payment_proof_path: path })
          .eq("id", registration.id);
        if (updateError) throw new ActionError(updateError.message);
      }
    } catch (e) {
      // Storage has no directory delete — list what landed, then remove it.
      const { data: stray } = await db.storage
        .from(REGISTRATION_BUCKET)
        .list(registration.id);
      if (stray?.length) {
        await db.storage
          .from(REGISTRATION_BUCKET)
          .remove(stray.map((f) => `${registration.id}/${f.name}`));
      }
      await db.from("registrations").delete().eq("id", registration.id);
      throw e;
    }

    revalidatePath(`/dashboard/tournaments/${category.tournament_id}/registrations`);
    return registration.reference_code;
  });
}

/**
 * Late payment: a team that registered without paying uploads its receipt from
 * its own reference link. Allowed while the registration is live and the money
 * has not already been verified.
 */
export async function uploadPaymentProof(rawCode: string, form: FormData) {
  return run(async () => {
    const code = normalizeReferenceCode(rawCode);
    if (!code) throw new ActionError("That reference code is not valid.");

    const proof = fileFrom(form, "payment_proof");
    if (!proof) throw new ActionError("Choose an image of your receipt.");
    assertValidImage(proof, "Proof of payment");

    const db = registrationClient();
    const { data: registration } = await db
      .from("registrations")
      .select("*")
      .eq("reference_code", code)
      .maybeSingle();
    if (!registration) throw new ActionError("Registration not found.");

    const reg = registration as Registration;
    if (reg.status === "cancelled" || reg.status === "disqualified") {
      throw new ActionError(
        "This registration is no longer active, so payment can't be submitted.",
      );
    }
    if (reg.payment_status === "verified") {
      throw new ActionError("Your payment has already been verified.");
    }

    const reference = (form.get("payment_reference") as string | null)?.trim();
    const path = await uploadImage(
      db,
      proof,
      `${reg.id}/payment.${extensionFor(proof)}`,
    );
    const { error } = await db
      .from("registrations")
      .update({
        payment_proof_path: path,
        payment_reference: reference || reg.payment_reference,
        payment_status: "submitted",
        payment_submitted_at: new Date().toISOString(),
      })
      .eq("id", reg.id);
    if (error) throw new ActionError(error.message);

    revalidatePath(`/r/${code}`);
    revalidatePath(`/dashboard/tournaments/${reg.tournament_id}/registrations`);
  });
}

// ---------------------------------------------------------------------------
// Manager settings
// ---------------------------------------------------------------------------

export async function updatePaymentSettings(
  tournamentId: string,
  input: unknown,
) {
  return run(async () => {
    const parsed = paymentSettingsSchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");
    const { error } = await supabase
      .from("tournaments")
      .update({
        payment_name: parsed.payment_name?.trim() || null,
        payment_number: parsed.payment_number?.trim() || null,
        payment_qr: parsed.payment_qr?.trim() || null,
        payment_instructions: parsed.payment_instructions?.trim() || null,
      })
      .eq("id", tournamentId);
    if (error) throw new ActionError(error.message);
    await logAudit(tournamentId, "tournament.payment_settings", {});
    revalidatePath(`/dashboard/tournaments/${tournamentId}/settings`);
    revalidatePath("/tournament", "layout");
  });
}

export async function updateCategoryRegistration(
  tournamentId: string,
  categoryId: string,
  input: unknown,
) {
  return run(async () => {
    const parsed = categoryRegistrationSchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");

    const deadline = parsed.registration_deadline?.trim();
    const maxTeams =
      parsed.max_teams === "" || parsed.max_teams === undefined
        ? null
        : Number(parsed.max_teams);

    const { error } = await supabase
      .from("categories")
      .update({
        format: parsed.format,
        registration_open: parsed.registration_open,
        // Already an absolute instant (converted browser-side from the
        // manager's local `datetime-local` value).
        registration_deadline: deadline || null,
        max_teams: maxTeams,
        registration_fee: parsed.registration_fee,
        require_payment_upfront: parsed.require_payment_upfront,
        collect_shirt_sizes: parsed.collect_shirt_sizes,
        require_player_id: parsed.require_player_id,
      })
      .eq("id", categoryId)
      .eq("tournament_id", tournamentId);
    if (error) throw new ActionError(error.message);

    await logAudit(tournamentId, "category.registration_settings", {
      categoryId,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/settings`);
    revalidatePath("/tournament", "layout");
  });
}

// ---------------------------------------------------------------------------
// Manager decisions
// ---------------------------------------------------------------------------

/**
 * Keep `participants` in step with the approval decision: approving a team
 * puts it in the bracket, reversing that takes it back out. Both directions
 * require the category to still be a draft, because groups and matches are
 * generated from the participant list.
 */
async function syncParticipant(
  supabase: SupabaseClient<Database>,
  registration: Registration,
  nextStatus: RegistrationStatus,
): Promise<string | null> {
  const { data: categoryRow } = await supabase
    .from("categories")
    .select("*")
    .eq("id", registration.category_id)
    .maybeSingle();
  if (!categoryRow) throw new ActionError("Category not found.");
  const category = categoryRow as Category;

  const shouldCompete = nextStatus === "approved";
  const alreadyCompeting = Boolean(registration.participant_id);
  if (shouldCompete === alreadyCompeting) return registration.participant_id;

  if (category.status !== "draft") {
    throw new ActionError(
      "The group stage has started, so the team list for this category is locked. Approve or remove teams before generating groups.",
    );
  }

  if (shouldCompete) {
    if (category.max_teams !== null) {
      const { count } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("category_id", category.id)
        .eq("status", "approved");
      if ((count ?? 0) >= category.max_teams) {
        throw new ActionError(
          `This category is full (${category.max_teams} teams). Raise the team limit to approve more.`,
        );
      }
    }
    const { count: seedCount } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("category_id", category.id);
    const { data, error } = await supabase
      .from("participants")
      .insert({
        tournament_id: registration.tournament_id,
        category_id: category.id,
        name: registration.team_name,
        seed: (seedCount ?? 0) + 1,
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);
    return data.id;
  }

  const { error } = await supabase
    .from("participants")
    .delete()
    .eq("id", registration.participant_id!);
  if (error) throw new ActionError(error.message);
  return null;
}

export async function decideRegistration(
  tournamentId: string,
  registrationId: string,
  input: unknown,
) {
  return run(async () => {
    const parsed = registrationDecisionSchema.parse(input);
    const { supabase, user } = await assertRole(tournamentId, "admin");

    const { data: row, error: fetchError } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", registrationId)
      .eq("tournament_id", tournamentId)
      .maybeSingle();
    if (fetchError) throw new ActionError(fetchError.message);
    if (!row) throw new ActionError("Registration not found.");
    const registration = row as Registration;

    const participantId = await syncParticipant(
      supabase,
      registration,
      parsed.status,
    );

    const { error } = await supabase
      .from("registrations")
      .update({
        status: parsed.status,
        // The dialog pre-fills the current note, so an empty box is a
        // deliberate clear rather than "leave it alone".
        admin_note: parsed.admin_note?.trim() || null,
        participant_id: participantId,
        decided_at: new Date().toISOString(),
        decided_by: user.id,
      })
      .eq("id", registrationId);
    if (error) throw new ActionError(error.message);

    await logAudit(tournamentId, "registration.decide", {
      registrationId,
      status: parsed.status,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/registrations`);
    revalidatePath(`/dashboard/tournaments/${tournamentId}/participants`);
    revalidatePath(`/r/${registration.reference_code}`);
  });
}

export async function setPaymentStatus(
  tournamentId: string,
  registrationId: string,
  input: unknown,
) {
  return run(async () => {
    const parsed = paymentDecisionSchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: row } = await supabase
      .from("registrations")
      .select("reference_code")
      .eq("id", registrationId)
      .eq("tournament_id", tournamentId)
      .maybeSingle();
    if (!row) throw new ActionError("Registration not found.");

    const { error } = await supabase
      .from("registrations")
      .update({
        payment_status: parsed.payment_status,
        ...(parsed.admin_note !== undefined
          ? { admin_note: parsed.admin_note.trim() || null }
          : {}),
      })
      .eq("id", registrationId);
    if (error) throw new ActionError(error.message);

    await logAudit(tournamentId, "registration.payment", {
      registrationId,
      payment_status: parsed.payment_status,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/registrations`);
    revalidatePath(`/r/${row.reference_code}`);
  });
}

/**
 * Deleting registrations is disabled — they are the audit trail for payments,
 * uploads and the reference codes handed to teams. Mark an entry `cancelled`
 * instead; that also releases its participant row.
 *
 * Kept as a stub so any stale caller fails loudly instead of silently
 * destroying data.
 */
export async function deleteRegistration() {
  return run(async () => {
    throw new ActionError(
      "Deleting registrations is disabled. Mark the entry cancelled instead.",
    );
  });
}
