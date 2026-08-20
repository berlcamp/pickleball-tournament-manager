import { z } from "zod";
import { MATCH_INTERVALS } from "@/lib/constants";
import { shortCodeProblem } from "@/lib/short-code";

export const tournamentSchema = z.object({
  name: z.string().min(2, "Name is too short").max(120),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  banner: z.string().url().optional().or(z.literal("")),
  show_public_schedule: z.boolean().default(true),
});
export type TournamentInput = z.infer<typeof tournamentSchema>;

export const shortCodeSchema = z.object({
  short_code: z
    .string()
    .trim()
    .toLowerCase()
    // superRefine so the specific reason (too short / bad characters /
    // reserved word) reaches the organizer instead of a generic message.
    .superRefine((value, ctx) => {
      const problem = shortCodeProblem(value);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
});
export type ShortCodeInput = z.infer<typeof shortCodeSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(120),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/** Creating a tournament also creates its categories (at least one). */
export const createTournamentSchema = tournamentSchema.extend({
  categories: z.array(categorySchema).min(1, "Add at least one category"),
});
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export const participantSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
});

export const bulkParticipantsSchema = z.object({
  names: z.string().min(1, "Add at least one team"),
});

export const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["admin", "scorekeeper", "viewer"]),
});

export const groupGenSchema = z.object({
  num_groups: z.coerce.number().int().min(1).max(26),
});

export const scoreSchema = z.object({
  sets: z
    .array(
      z.object({
        participant1_score: z.coerce.number().int().min(0).max(99),
        participant2_score: z.coerce.number().int().min(0).max(99),
      }),
    )
    .min(1),
});

export const scheduleSchema = z.object({
  venue_name: z.string().trim().max(120).optional(),
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  match_interval: z.coerce
    .number()
    .refine((v) => (MATCH_INTERVALS as readonly number[]).includes(v)),
  num_courts: z.coerce.number().int().min(1).max(20),
  schedule_mode: z.enum(["sequential", "distributed"]),
  knockout_rounds: z.enum(["none", "semifinals", "finals"]).default("none"),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;

export const profileSchema = z.object({
  full_name: z.string().min(1).max(120),
});
