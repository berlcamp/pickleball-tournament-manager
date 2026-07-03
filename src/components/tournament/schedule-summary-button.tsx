"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTime, timeToMinutes } from "@/lib/format";
import type { ScheduleRow } from "@/components/tournament/schedule-table";

const STATUS_LABEL: Record<ScheduleRow["status"], string> = {
  pending: "Pending",
  in_progress: "Live",
  completed: "Final",
};

/**
 * Downloads a multi-category schedule as a PDF. Each category becomes its own
 * heading + table (sorted by date, time, court); jsPDF/autotable are loaded
 * lazily so they stay out of the main bundle.
 */
export function ScheduleSummaryButton({
  rows,
  tournamentName,
}: {
  rows: ScheduleRow[];
  tournamentName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape" });
      const marginX = 14;
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFontSize(16);
      doc.text(tournamentName, marginX, 16);
      doc.setFontSize(11);
      doc.setTextColor(120);
      doc.text(
        `Schedule Summary · ${formatDate(new Date().toISOString().slice(0, 10))}`,
        marginX,
        22,
      );
      doc.setTextColor(0);

      // One section per category, preserving the order categories first appear.
      const byCategory = new Map<string, ScheduleRow[]>();
      for (const r of rows) {
        const key = r.category ?? "Schedule";
        if (!byCategory.has(key)) byCategory.set(key, []);
        byCategory.get(key)!.push(r);
      }

      let startY = 30;
      for (const [category, catRows] of byCategory) {
        const venue = catRows.find((r) => r.venue)?.venue;
        const heading = venue ? `${category} — ${venue}` : category;

        // Keep the heading with its table: break to a new page if it would land
        // at the very bottom.
        if (startY > pageHeight - 30) {
          doc.addPage();
          startY = 20;
        }

        doc.setFontSize(12);
        doc.text(heading, marginX, startY);
        startY += 3;

        const sorted = [...catRows].sort((a, b) => {
          const da = a.date ?? "9999-99-99";
          const db = b.date ?? "9999-99-99";
          if (da !== db) return da.localeCompare(db);
          const ta = a.time ? timeToMinutes(a.time) : 9999;
          const tb = b.time ? timeToMinutes(b.time) : 9999;
          if (ta !== tb) return ta - tb;
          return a.court.localeCompare(b.court);
        });

        autoTable(doc, {
          startY,
          head: [["Date", "Time", "Court", "Match", "Group", "Status"]],
          body: sorted.map((r) => [
            r.date ? formatDate(r.date) : "—",
            formatTime(r.time),
            r.court,
            `${r.team1}  vs  ${r.team2}`,
            r.group,
            r.queued && r.status === "pending"
              ? "Queued"
              : STATUS_LABEL[r.status],
          ]),
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [22, 163, 74], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: marginX, right: marginX },
        });

        const finalY = (
          doc as unknown as { lastAutoTable: { finalY: number } }
        ).lastAutoTable.finalY;
        startY = finalY + 12;
      }

      // Page numbers in the footer.
      const pages = doc.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i} of ${pages}`,
          pageWidth - marginX,
          pageHeight - 8,
          { align: "right" },
        );
      }

      const safeName =
        tournamentName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") ||
        "tournament";
      doc.save(`${safeName}-schedule.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={download}
      disabled={busy || rows.length === 0}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileDown className="size-4" />
      )}
      Schedule Summary
    </Button>
  );
}
