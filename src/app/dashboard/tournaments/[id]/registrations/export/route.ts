import { NextResponse, type NextRequest } from "next/server";
import { getTournamentContext } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import {
  listRegistrations,
  registrationsEnabled,
} from "@/lib/registration-data";
import { slugify } from "@/lib/format";

/** Escape a value for CSV; the leading-quote guard blocks formula injection. */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

const HEADERS = [
  "Reference",
  "Category",
  "Team",
  "Player 1",
  "Shirt 1",
  "Player 2",
  "Shirt 2",
  "Contact",
  "Email",
  "Club",
  "Club address",
  "Status",
  "Payment",
  "Fee",
  "Payment reference",
  "Registered",
  "Note",
];

/**
 * CSV of the tournament's registrations — the roster, shirt-size tally and
 * payment reconciliation sheet organizers actually print.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getTournamentContext(id);
  if (!ctx || !roleAtLeast(ctx.role, "admin")) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!registrationsEnabled()) {
    return new NextResponse("Registration is not configured", { status: 503 });
  }

  const categoryId = request.nextUrl.searchParams.get("category");
  const categoryName = new Map(ctx.categories.map((c) => [c.id, c.name]));

  const rows = (await listRegistrations(id)).filter(
    (r) => !categoryId || r.category_id === categoryId,
  );

  const lines = [
    HEADERS.map(cell).join(","),
    ...rows.map((r) => {
      const [p1, p2] = r.players;
      return [
        r.reference_code,
        categoryName.get(r.category_id) ?? "",
        r.team_name,
        p1?.full_name ?? "",
        p1?.shirt_size ?? "",
        p2?.full_name ?? "",
        p2?.shirt_size ?? "",
        r.contact_number,
        r.contact_email ?? "",
        r.club_name ?? "",
        r.club_address ?? "",
        r.status,
        r.payment_status,
        Number(r.fee_amount),
        r.payment_reference ?? "",
        r.created_at,
        r.admin_note ?? "",
      ]
        .map(cell)
        .join(",");
    }),
  ];

  const suffix = categoryId
    ? `-${slugify(categoryName.get(categoryId) ?? "category")}`
    : "";
  const filename = `${slugify(ctx.tournament.name)}${suffix}-registrations.csv`;

  // BOM so Excel opens UTF-8 names (ñ, é) correctly.
  return new NextResponse(`﻿${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
