export type Role = "owner" | "admin" | "scorekeeper" | "viewer";

export type TournamentStatus =
  | "draft"
  | "group_stage"
  | "final_stage"
  | "completed";

/** A category is contested either 1-v-1 or 2-v-2. Drives the player fields
 * shown on the public registration form. */
export type CategoryFormat = "singles" | "doubles";

/** Admin decision on a submitted registration. */
export type RegistrationStatus =
  | "pending"
  | "approved"
  | "disqualified"
  | "cancelled";

/** Money state, tracked separately from `RegistrationStatus` so a team can be
 * approved while still unpaid. */
export type PaymentStatus = "unpaid" | "submitted" | "verified" | "refunded";

export const SHIRT_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];

export type MatchStatus = "pending" | "in_progress" | "completed";

export type ScheduleMode = "sequential" | "distributed";

/** How far into the knockout bracket the schedule should reserve slots. */
export type KnockoutRounds = "none" | "semifinals" | "finals";

export type InviteStatus = "pending" | "accepted" | "declined";

export type StandingStatus =
  | "advanced"
  | "qualified"
  | "eliminated"
  | "champion"
  | "runner_up"
  | "none";

export type PlacementType =
  | "champion"
  | "runner_up"
  | "second_runner_up"
  | "third_place";

/** Tournament-level settings — the shared schedule configuration. */
export type TournamentSettings = {
  schedule_mode?: ScheduleMode;
  start_time?: string; // "08:00"
  end_time?: string; // "17:00"
  match_interval?: number; // minutes
  num_courts?: number;
  knockout_rounds?: KnockoutRounds;
}

/** Per-category settings (each category is an independent competition). */
export type CategorySettings = {
  random_tiebreak?: boolean;
  // Each category schedules independently and remembers its own configuration.
  // Its calendar day is NOT here — that lives on `Category.event_date`.
  venue_name?: string;
  schedule_mode?: ScheduleMode;
  start_time?: string; // "08:00"
  end_time?: string; // "17:00"
  match_interval?: number; // minutes
  num_courts?: number;
  knockout_rounds?: KnockoutRounds;
}

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type Tournament = {
  id: string;
  /** Long, name-derived slug. Kept so existing links keep resolving. */
  slug: string;
  /** Memorable public code serving the portal at `/{short_code}`. */
  short_code: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string | null;
  banner: string | null;
  settings: TournamentSettings;
  show_public_schedule: boolean;
  /** GCash (or other) account collecting registration fees, tournament-wide. */
  payment_name: string | null;
  payment_number: string | null;
  /** Public URL of an optional payment QR image. */
  payment_qr: string | null;
  payment_instructions: string | null;
  created_by: string;
  created_at: string;
}

export type Category = {
  id: string;
  tournament_id: string;
  name: string;
  position: number;
  status: TournamentStatus;
  settings: CategorySettings;
  /** The calendar day this category is played ("2026-07-03"); null = TBD. */
  event_date: string | null;
  created_at: string;
  // ----- public registration settings -----
  format: CategoryFormat;
  registration_open: boolean;
  /** ISO timestamp; registration auto-closes once it passes. */
  registration_deadline: string | null;
  /** Cap on APPROVED teams; null means unlimited. */
  max_teams: number | null;
  registration_fee: number;
  /** true → proof of payment required to submit; false → pay later via link. */
  require_payment_upfront: boolean;
  collect_shirt_sizes: boolean;
  require_player_id: boolean;
}

export type TournamentMember = {
  id: string;
  tournament_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export type TournamentInvite = {
  id: string;
  tournament_id: string;
  email: string;
  role: Role;
  status: InviteStatus;
  invited_by: string | null;
  created_at: string;
}

export type Participant = {
  id: string;
  tournament_id: string;
  category_id: string;
  name: string;
  seed: number | null;
  created_at: string;
}

export type Group = {
  id: string;
  tournament_id: string;
  category_id: string;
  name: string;
  position: number;
  created_at: string;
}

export type GroupMember = {
  id: string;
  group_id: string;
  participant_id: string;
  seed_in_group: number;
}

export type GroupMatch = {
  id: string;
  tournament_id: string;
  category_id: string;
  group_id: string;
  participant1_id: string | null;
  participant2_id: string | null;
  round: number;
  status: MatchStatus;
  winner_id: string | null;
  created_at: string;
}

export type GroupMatchScore = {
  id: string;
  match_id: string;
  set_number: number;
  participant1_score: number;
  participant2_score: number;
}

export type Standing = {
  id: string;
  tournament_id: string;
  category_id: string;
  group_id: string;
  participant_id: string;
  rank: number;
  status: StandingStatus;
  matches_won: number;
  matches_lost: number;
  matches_tied: number;
  tie_break: number;
  set_wins: number;
  set_ties: number;
  points: number;
  point_diff: number;
  history: ("W" | "L" | "T")[];
}

export type FinalMatch = {
  id: string;
  tournament_id: string;
  category_id: string;
  round: number;
  slot: number;
  label: string | null;
  participant1_id: string | null;
  participant2_id: string | null;
  source1: string | null;
  source2: string | null;
  status: MatchStatus;
  winner_id: string | null;
  created_at: string;
}

export type MatchScore = {
  id: string;
  final_match_id: string;
  set_number: number;
  participant1_score: number;
  participant2_score: number;
}

export type Placement = {
  id: string;
  tournament_id: string;
  category_id: string | null;
  placement: PlacementType;
  participant_id: string | null;
}

export type Court = {
  id: string;
  tournament_id: string;
  name: string;
  position: number;
}

export type MatchSchedule = {
  id: string;
  tournament_id: string;
  category_id: string | null;
  match_type: "group" | "final" | "knockout";
  match_id: string;
  court_id: string | null;
  scheduled_time: string | null;
  /** Calendar date the matches fall on, ISO "YYYY-MM-DD". */
  scheduled_date: string | null;
  status: MatchStatus;
  /** Staff-set flag: this match is queued / called to the court next. */
  queued: boolean;
  /** Round label for reserved knockout placeholder slots, e.g. "Semifinal 1". */
  label: string | null;
}

export type AuditLog = {
  id: string;
  tournament_id: string;
  user_id: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export type Registration = {
  id: string;
  tournament_id: string;
  category_id: string;
  /** Human-quotable, unguessable code that also forms the status-page URL. */
  reference_code: string;
  team_name: string;
  contact_number: string;
  contact_email: string | null;
  /** Club the team represents. Null only on rows taken before 0014. */
  club_name: string | null;
  club_address: string | null;
  status: RegistrationStatus;
  payment_status: PaymentStatus;
  /** Fee snapshot taken at submission time. */
  fee_amount: number;
  payment_reference: string | null;
  /** Storage object path in the private `pickleball-registrations` bucket. */
  payment_proof_path: string | null;
  payment_submitted_at: string | null;
  admin_note: string | null;
  /** Set once approved — the `participants` row this team competes as. */
  participant_id: string | null;
  submitted_ip: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RegistrationPlayer = {
  id: string;
  registration_id: string;
  /** 1 for singles; 1 and 2 for doubles. */
  position: number;
  full_name: string;
  shirt_size: string | null;
  id_photo_path: string | null;
  created_at: string;
}
