export type Role = "owner" | "admin" | "scorekeeper" | "viewer";

export type TournamentStatus =
  | "draft"
  | "group_stage"
  | "final_stage"
  | "completed";

export type FinalBracketType = "crossover" | "standard_seed";

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
  rest_period?: number; // minutes
  num_courts?: number;
  knockout_rounds?: KnockoutRounds;
}

/** Per-category settings (each category is an independent competition). */
export type CategorySettings = {
  random_tiebreak?: boolean;
  // Each category schedules independently and remembers its own configuration.
  venue_name?: string;
  event_date?: string; // "2026-07-03"
  schedule_mode?: ScheduleMode;
  start_time?: string; // "08:00"
  end_time?: string; // "17:00"
  match_interval?: number; // minutes
  rest_period?: number; // minutes
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
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string | null;
  banner: string | null;
  settings: TournamentSettings;
  show_public_schedule: boolean;
  created_by: string;
  created_at: string;
}

export type Category = {
  id: string;
  tournament_id: string;
  name: string;
  position: number;
  status: TournamentStatus;
  final_bracket_type: FinalBracketType;
  settings: CategorySettings;
  created_at: string;
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

// ---------- Raffle module ----------------------------------------------------

export type Raffle = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RaffleDepartment = {
  id: string;
  raffle_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export type RaffleEntry = {
  id: string;
  raffle_id: string;
  department_id: string;
  name: string;
  designation: string | null;
  created_at: string;
}

export type RaffleWinner = {
  id: string;
  raffle_id: string;
  department_id: string;
  entry_id: string;
  entry_name: string;
  entry_designation: string | null;
  department_name: string;
  prize_label: string | null;
  session_id: string;
  draw_index: number;
  drawn_by: string | null;
  drawn_at: string;
}
