"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { ActionError, getSessionUser, run } from "./helpers";
import {
  addEntriesBulkSchema,
  clearDepartmentEntriesSchema,
  clearWinnersSchema,
  createDepartmentSchema,
  createRaffleSchema,
  deleteDepartmentSchema,
  deleteEntrySchema,
  deleteRaffleSchema,
  drawWinnerSchema,
  resetSessionSchema,
  updateDepartmentSchema,
  updateEntrySchema,
  updateRaffleSchema,
} from "@/validators/raffle";
import type {
  Raffle,
  RaffleDepartment,
  RaffleEntry,
  RaffleWinner,
} from "@/types";

const LIST_PATH = "/dashboard/raffle";
const detailPath = (raffleId: string) => `/dashboard/raffle/${raffleId}`;

/** First zod issue message, or a generic fallback. */
function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

// ── Raffle CRUD ──────────────────────────────────────────────────────────

export async function getRaffles() {
  return run<Raffle[]>(async () => {
    const { supabase } = await getSessionUser();
    const { data, error } = await supabase
      .from("raffles")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new ActionError(error.message);
    return data ?? [];
  });
}

export type RaffleDetail = {
  raffle: Raffle;
  departments: (RaffleDepartment & { entry_count: number })[];
};

export async function getRaffle(id: string) {
  return run<RaffleDetail>(async () => {
    const { supabase } = await getSessionUser();
    const { data: raffle, error: raffleError } = await supabase
      .from("raffles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (raffleError) throw new ActionError(raffleError.message);
    if (!raffle) throw new ActionError("Raffle not found.");

    const { data: departments, error: deptError } = await supabase
      .from("raffle_departments")
      .select("*")
      .eq("raffle_id", id)
      .order("name", { ascending: true });
    if (deptError) throw new ActionError(deptError.message);

    const deptList = departments ?? [];
    const counts = new Map<string, number>();
    if (deptList.length > 0) {
      const { data: entryRows } = await supabase
        .from("raffle_entries")
        .select("department_id")
        .eq("raffle_id", id);
      for (const row of entryRows ?? []) {
        counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
      }
    }

    return {
      raffle,
      departments: deptList.map((d) => ({
        ...d,
        entry_count: counts.get(d.id) ?? 0,
      })),
    };
  });
}

export async function createRaffle(input: unknown) {
  return run<{ id: string }>(async () => {
    const { supabase, user } = await getSessionUser();
    const parsed = createRaffleSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));

    const { data, error } = await supabase
      .from("raffles")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);

    revalidatePath(LIST_PATH);
    return { id: data.id };
  });
}

export async function updateRaffle(input: unknown) {
  return run(async () => {
    const { supabase } = await getSessionUser();
    const parsed = updateRaffleSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));

    const { error } = await supabase
      .from("raffles")
      .update({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .eq("id", parsed.data.id);
    if (error) throw new ActionError(error.message);

    revalidatePath(LIST_PATH);
    revalidatePath(detailPath(parsed.data.id));
  });
}

export async function deleteRaffle(input: unknown) {
  return run(async () => {
    const { supabase } = await getSessionUser();
    const parsed = deleteRaffleSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Invalid input.");

    // Soft-delete to keep winner history queryable.
    const { error } = await supabase
      .from("raffles")
      .update({ is_active: false })
      .eq("id", parsed.data.id);
    if (error) throw new ActionError(error.message);

    revalidatePath(LIST_PATH);
  });
}

// ── Departments ────────────────────────────────────────────────────────────

export async function createDepartment(input: unknown) {
  return run<{ id: string }>(async () => {
    const { supabase } = await getSessionUser();
    const parsed = createDepartmentSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));

    const { data, error } = await supabase
      .from("raffle_departments")
      .insert({ raffle_id: parsed.data.raffle_id, name: parsed.data.name })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new ActionError(
          "A department with that name already exists in this raffle.",
        );
      }
      throw new ActionError(error.message);
    }

    revalidatePath(detailPath(parsed.data.raffle_id));
    return { id: data.id };
  });
}

export async function updateDepartment(input: unknown) {
  return run(async () => {
    const { supabase } = await getSessionUser();
    const parsed = updateDepartmentSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));

    const { data, error } = await supabase
      .from("raffle_departments")
      .update({ name: parsed.data.name })
      .eq("id", parsed.data.id)
      .select("raffle_id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new ActionError(
          "A department with that name already exists in this raffle.",
        );
      }
      throw new ActionError(error.message);
    }

    if (data) revalidatePath(detailPath(data.raffle_id));
  });
}

export async function deleteDepartment(input: unknown) {
  return run(async () => {
    const { supabase } = await getSessionUser();
    const parsed = deleteDepartmentSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Invalid input.");

    const { data: existing } = await supabase
      .from("raffle_departments")
      .select("raffle_id")
      .eq("id", parsed.data.id)
      .maybeSingle();

    const { error } = await supabase
      .from("raffle_departments")
      .delete()
      .eq("id", parsed.data.id);
    if (error) throw new ActionError(error.message);

    if (existing) revalidatePath(detailPath(existing.raffle_id));
  });
}

// ── Entries ──────────────────────────────────────────────────────────────

export async function getEntriesForDepartment(departmentId: string) {
  return run<RaffleEntry[]>(async () => {
    const { supabase } = await getSessionUser();
    const { data, error } = await supabase
      .from("raffle_entries")
      .select("*")
      .eq("department_id", departmentId)
      .order("name", { ascending: true });
    if (error) throw new ActionError(error.message);
    return data ?? [];
  });
}

type PoolEntry = Pick<RaffleEntry, "id" | "name" | "designation" | "department_id">;

export async function getRaffleEntries(raffleId: string, departmentId?: string) {
  return run<PoolEntry[]>(async () => {
    const { supabase } = await getSessionUser();
    let q = supabase
      .from("raffle_entries")
      .select("id, name, designation, department_id")
      .eq("raffle_id", raffleId);
    if (departmentId) q = q.eq("department_id", departmentId);
    const { data, error } = await q;
    if (error) throw new ActionError(error.message);
    return (data ?? []) as PoolEntry[];
  });
}

export async function addEntriesBulk(input: unknown) {
  return run<{ inserted: number }>(async () => {
    const { supabase } = await getSessionUser();
    const parsed = addEntriesBulkSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));

    const { data: dept, error: deptError } = await supabase
      .from("raffle_departments")
      .select("id, raffle_id")
      .eq("id", parsed.data.department_id)
      .maybeSingle();
    if (deptError) throw new ActionError(deptError.message);
    if (!dept) throw new ActionError("Department not found.");

    // Chunk inserts so we don't hit a payload size limit on huge pastes.
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < parsed.data.entries.length; i += CHUNK) {
      const slice = parsed.data.entries.slice(i, i + CHUNK).map((entry) => ({
        department_id: dept.id,
        raffle_id: dept.raffle_id,
        name: entry.name,
        designation: entry.designation ?? null,
      }));
      const { error } = await supabase.from("raffle_entries").insert(slice);
      if (error) throw new ActionError(error.message);
      inserted += slice.length;
    }

    revalidatePath(detailPath(dept.raffle_id));
    return { inserted };
  });
}

export async function updateEntry(input: unknown) {
  return run(async () => {
    const { supabase } = await getSessionUser();
    const parsed = updateEntrySchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));

    const { data, error } = await supabase
      .from("raffle_entries")
      .update({
        name: parsed.data.name,
        designation: parsed.data.designation ?? null,
      })
      .eq("id", parsed.data.id)
      .select("raffle_id")
      .single();
    if (error) throw new ActionError(error.message);

    if (data) revalidatePath(detailPath(data.raffle_id));
  });
}

export async function deleteEntry(input: unknown) {
  return run(async () => {
    const { supabase } = await getSessionUser();
    const parsed = deleteEntrySchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Invalid input.");

    const { data: existing } = await supabase
      .from("raffle_entries")
      .select("raffle_id")
      .eq("id", parsed.data.id)
      .maybeSingle();

    const { error } = await supabase
      .from("raffle_entries")
      .delete()
      .eq("id", parsed.data.id);
    if (error) throw new ActionError(error.message);

    if (existing) revalidatePath(detailPath(existing.raffle_id));
  });
}

export async function clearDepartmentEntries(input: unknown) {
  return run<{ deleted: number }>(async () => {
    const { supabase } = await getSessionUser();
    const parsed = clearDepartmentEntriesSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Invalid input.");

    const { data: dept } = await supabase
      .from("raffle_departments")
      .select("raffle_id")
      .eq("id", parsed.data.department_id)
      .maybeSingle();

    const { error, count } = await supabase
      .from("raffle_entries")
      .delete({ count: "exact" })
      .eq("department_id", parsed.data.department_id);
    if (error) throw new ActionError(error.message);

    if (dept) revalidatePath(detailPath(dept.raffle_id));
    return { deleted: count ?? 0 };
  });
}

// ── Winners ──────────────────────────────────────────────────────────────

export async function getRaffleWinners(raffleId: string) {
  return run<RaffleWinner[]>(async () => {
    const { supabase } = await getSessionUser();
    const { data, error } = await supabase
      .from("raffle_winners")
      .select("*")
      .eq("raffle_id", raffleId)
      .order("drawn_at", { ascending: false });
    if (error) throw new ActionError(error.message);
    return data ?? [];
  });
}

export type DrawWinnerResult = {
  id: string;
  entry_id: string;
  entry_name: string;
  entry_designation: string | null;
  department_id: string;
  department_name: string;
  draw_index: number;
  session_id: string;
};

export async function drawWinner(input: unknown) {
  return run<DrawWinnerResult>(async () => {
    const { supabase, user } = await getSessionUser();
    const parsed = drawWinnerSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));

    // Pool: entries scoped to raffle + optional department, minus excluded ids
    // (the caller passes in-session winners so duplicates are impossible).
    let q = supabase
      .from("raffle_entries")
      .select("id, name, designation, department_id")
      .eq("raffle_id", parsed.data.raffle_id);
    if (parsed.data.department_id) q = q.eq("department_id", parsed.data.department_id);
    const { data: pool, error: poolError } = await q;
    if (poolError) throw new ActionError(poolError.message);

    const excluded = new Set(parsed.data.excluded_entry_ids);
    const eligible = (pool ?? []).filter((e) => !excluded.has(e.id));
    if (eligible.length === 0) throw new ActionError("No eligible entries to draw.");

    const pick = eligible[randomInt(0, eligible.length)];

    const { data: dept, error: deptError } = await supabase
      .from("raffle_departments")
      .select("id, name")
      .eq("id", pick.department_id)
      .maybeSingle();
    if (deptError) throw new ActionError(deptError.message);
    if (!dept) throw new ActionError("Department for the drawn entry no longer exists.");

    // Compute the next draw_index for this session.
    const { data: prior, error: priorError } = await supabase
      .from("raffle_winners")
      .select("draw_index")
      .eq("session_id", parsed.data.session_id)
      .order("draw_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorError) throw new ActionError(priorError.message);
    const drawIndex = (prior?.draw_index ?? 0) + 1;

    const { data: winner, error: insertError } = await supabase
      .from("raffle_winners")
      .insert({
        raffle_id: parsed.data.raffle_id,
        department_id: dept.id,
        entry_id: pick.id,
        entry_name: pick.name,
        entry_designation: pick.designation ?? null,
        department_name: dept.name,
        prize_label: parsed.data.prize_label ?? null,
        session_id: parsed.data.session_id,
        draw_index: drawIndex,
        drawn_by: user.id,
      })
      .select("id")
      .single();
    if (insertError) throw new ActionError(insertError.message);

    revalidatePath(detailPath(parsed.data.raffle_id));

    return {
      id: winner.id,
      entry_id: pick.id,
      entry_name: pick.name,
      entry_designation: pick.designation ?? null,
      department_id: dept.id,
      department_name: dept.name,
      draw_index: drawIndex,
      session_id: parsed.data.session_id,
    };
  });
}

export async function resetSession(input: unknown) {
  return run<{ deleted: number }>(async () => {
    const { supabase } = await getSessionUser();
    const parsed = resetSessionSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Invalid input.");

    const { error, count } = await supabase
      .from("raffle_winners")
      .delete({ count: "exact" })
      .eq("raffle_id", parsed.data.raffle_id)
      .eq("session_id", parsed.data.session_id);
    if (error) throw new ActionError(error.message);

    revalidatePath(detailPath(parsed.data.raffle_id));
    return { deleted: count ?? 0 };
  });
}

export async function clearWinners(input: unknown) {
  return run<{ deleted: number }>(async () => {
    const { supabase } = await getSessionUser();
    const parsed = clearWinnersSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Invalid input.");

    const { error, count } = await supabase
      .from("raffle_winners")
      .delete({ count: "exact" })
      .eq("raffle_id", parsed.data.raffle_id);
    if (error) throw new ActionError(error.message);

    revalidatePath(detailPath(parsed.data.raffle_id));
    return { deleted: count ?? 0 };
  });
}
