import type { CategoryFormat } from "@/types";
import type { RegistrationAvailability } from "@/services/registration";

/** Everything the public registration UI needs about one category. */
export type RegistrationCategory = {
  id: string;
  name: string;
  format: CategoryFormat;
  fee: number;
  requirePaymentUpfront: boolean;
  collectShirtSizes: boolean;
  requirePlayerId: boolean;
  deadline: string | null;
  /** The day this category is played ("2026-07-03"), or null if undecided. */
  eventDate: string | null;
  maxTeams: number | null;
  approvedCount: number;
  availability: RegistrationAvailability;
};

/** Tournament-wide payment account shown alongside the fee. */
export type PaymentDetails = {
  name: string | null;
  number: string | null;
  qr: string | null;
  instructions: string | null;
};
