import type {
  AuditLog,
  Category,
  Court,
  FinalMatch,
  Group,
  GroupMatch,
  GroupMatchScore,
  GroupMember,
  MatchSchedule,
  MatchScore,
  Participant,
  Placement,
  Profile,
  Standing,
  Tournament,
  TournamentInvite,
  TournamentMember,
} from "./index";

type TableShape<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Omit<Row, "id" | "created_at">> &
    Pick<Row, Required & keyof Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  pickleball: {
    Tables: {
      profiles: TableShape<Profile, "id" | "email">;
      tournaments: TableShape<Tournament, "name" | "created_by" | "slug">;
      categories: TableShape<Category, "tournament_id" | "name" | "position">;
      tournament_members: TableShape<
        TournamentMember,
        "tournament_id" | "user_id" | "role"
      >;
      tournament_invites: TableShape<
        TournamentInvite,
        "tournament_id" | "email" | "role"
      >;
      participants: TableShape<Participant, "tournament_id" | "category_id" | "name">;
      groups: TableShape<Group, "tournament_id" | "category_id" | "name" | "position">;
      group_members: TableShape<
        GroupMember,
        "group_id" | "participant_id" | "seed_in_group"
      >;
      group_matches: TableShape<
        GroupMatch,
        "tournament_id" | "category_id" | "group_id" | "round"
      >;
      group_match_scores: TableShape<
        GroupMatchScore,
        "match_id" | "set_number" | "participant1_score" | "participant2_score"
      >;
      standings: TableShape<
        Standing,
        "tournament_id" | "category_id" | "group_id" | "participant_id"
      >;
      final_matches: TableShape<
        FinalMatch,
        "tournament_id" | "category_id" | "round" | "slot"
      >;
      match_scores: TableShape<
        MatchScore,
        "final_match_id" | "set_number" | "participant1_score" | "participant2_score"
      >;
      placements: TableShape<Placement, "tournament_id" | "placement">;
      courts: TableShape<Court, "tournament_id" | "name" | "position">;
      match_schedules: TableShape<
        MatchSchedule,
        "tournament_id" | "match_type" | "match_id"
      >;
      audit_logs: TableShape<AuditLog, "tournament_id" | "action">;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      role: "owner" | "admin" | "scorekeeper" | "viewer";
      tournament_status: "draft" | "group_stage" | "final_stage" | "completed";
      final_bracket_type: "crossover" | "standard_seed";
      match_status: "pending" | "in_progress" | "completed";
    };
    CompositeTypes: Record<string, never>;
  };
};
