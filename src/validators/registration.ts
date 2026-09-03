import { z } from "zod";
import { SHIRT_SIZES } from "@/types";

/** Tournament-wide payment account. Fees themselves are per category. */
export const paymentSettingsSchema = z.object({
  payment_name: z.string().trim().max(120).optional().or(z.literal("")),
  payment_number: z.string().trim().max(40).optional().or(z.literal("")),
  payment_qr: z.string().trim().max(500).optional().or(z.literal("")),
  payment_instructions: z.string().trim().max(600).optional().or(z.literal("")),
});
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;

/** Per-category registration configuration set by the tournament manager. */
export const categoryRegistrationSchema = z
  .object({
    format: z.enum(["singles", "doubles"]),
    registration_open: z.boolean(),
    /**
     * Absolute ISO instant, converted from the manager's `datetime-local`
     * input in their own browser — a bare "2026-09-01T23:59" would otherwise
     * be read in the server's timezone (UTC in production) and shift the
     * deadline by hours. "" clears it.
     */
    registration_deadline: z
      .string()
      .trim()
      .datetime({ message: "Invalid deadline" })
      .optional()
      .or(z.literal("")),
    max_teams: z
      .union([z.coerce.number().int().min(1).max(512), z.literal("")])
      .optional(),
    registration_fee: z.coerce.number().min(0).max(1_000_000).default(0),
    require_payment_upfront: z.boolean(),
    collect_shirt_sizes: z.boolean(),
    require_player_id: z.boolean(),
  })
  .refine(
    (v) => !(v.require_payment_upfront && v.registration_fee <= 0),
    {
      message:
        "Set a registration fee before requiring proof of payment upfront.",
      path: ["registration_fee"],
    },
  );
export type CategoryRegistrationInput = z.infer<
  typeof categoryRegistrationSchema
>;

const playerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter the player's full name")
    .max(120),
  shirt_size: z.enum(SHIRT_SIZES).optional(),
});

/**
 * Public submission. This is the shape-level check only — whether shirt sizes,
 * ID photos and proof of payment are actually *required* depends on the
 * category's settings, so those rules are enforced server-side in
 * `submitRegistration` where the category row is available.
 */
export const publicRegistrationSchema = z.object({
  category_id: z.string().uuid("Choose a category"),
  players: z.array(playerSchema).min(1).max(2),
  contact_number: z
    .string()
    .trim()
    .min(7, "Enter a contact number")
    .max(32)
    .regex(/^[0-9+()\-\s]+$/, "Use digits, spaces, +, - or ()"),
  contact_email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(160)
    .optional()
    .or(z.literal("")),
  club_name: z
    .string()
    .trim()
    .min(2, "Enter your club name")
    .max(120),
  club_address: z
    .string()
    .trim()
    .min(5, "Enter your club address")
    .max(200),
  payment_reference: z.string().trim().max(120).optional().or(z.literal("")),
});
export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;

/** Admin decision on a submitted registration. */
export const registrationDecisionSchema = z.object({
  status: z.enum(["pending", "approved", "disqualified", "cancelled"]),
  admin_note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const paymentDecisionSchema = z.object({
  payment_status: z.enum(["unpaid", "submitted", "verified", "refunded"]),
  admin_note: z.string().trim().max(500).optional().or(z.literal("")),
});
