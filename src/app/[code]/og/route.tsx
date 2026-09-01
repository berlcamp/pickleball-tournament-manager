import { ImageResponse } from "next/og";
import { getTournamentByPublicRef, getPublicCategories } from "@/lib/data";
import { formatEventDates } from "@/lib/format";

/**
 * Fallback link-preview thumbnail for tournaments with no uploaded banner.
 *
 * When a banner exists the portal layout's `generateMetadata` points `og:image`
 * straight at the uploaded image and this route is never requested. Chat apps
 * crop previews to roughly 1.91:1, so the card is drawn at 1200×630.
 *
 * This is a plain route rather than the `opengraph-image` file convention on
 * purpose: that convention is collected at the page level and would override
 * the banner set by the layout's metadata.
 */
const size = { width: 1200, height: 630 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const tournament = await getTournamentByPublicRef(code);

  const categories = tournament
    ? await getPublicCategories(tournament.id)
    : [];

  const name = tournament?.name ?? "PicklePro";
  const meta = [
    tournament
      ? formatEventDates(
          tournament.start_date,
          categories.map((c) => c.event_date),
        )
      : null,
    tournament?.location,
  ]
    .filter(Boolean)
    .join("  ·  ");

  // Long names have to shrink or they overflow the card.
  const nameSize = name.length > 60 ? 60 : name.length > 34 ? 76 : 96;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#0a0f1a",
          backgroundImage:
            "radial-gradient(900px 900px at 100% -20%, rgba(34,197,94,0.22), transparent 60%), radial-gradient(800px 800px at -20% 120%, rgba(59,130,246,0.22), transparent 60%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 20,
              backgroundColor: "#22c55e",
              marginRight: 16,
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            PicklePro
          </div>
          <div
            style={{ fontSize: 30, color: "rgba(255,255,255,0.55)", marginLeft: 10 }}
          >
            by Sortbrite
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: nameSize,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            {name}
          </div>
          {meta && (
            <div
              style={{
                fontSize: 34,
                marginTop: 24,
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {meta}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <div style={{ display: "flex" }}>
            Live standings · Schedule · Registration
          </div>
          <div style={{ display: "flex", color: "#22c55e", fontWeight: 700 }}>
            sortbrite.com/{tournament?.short_code ?? code}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // Crawlers refetch previews often; let the CDN answer most of them.
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
