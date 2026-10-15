import { ImageResponse } from "next/og";
import { getTournamentByPublicRef, getPublicCategories } from "@/lib/data";
import { formatEventDates } from "@/lib/format";

/**
 * The link-preview thumbnail for every tournament (Facebook, Messenger,
 * Viber): the tournament's name, dates, venue and categories on a court-green
 * card drawn as a pickleball court — the same look as the portal header.
 *
 * Chat apps crop previews to roughly 1.91:1, so the card is drawn at 1200×630.
 * Colours are the theme's `--court` / `--ball` tokens converted to hex, since
 * the image renderer doesn't read CSS variables or oklch.
 *
 * This is a plain route rather than the `opengraph-image` file convention so
 * the portal's tabs can all point at one image (see `portal-metadata.ts`).
 */
const size = { width: 1200, height: 630 };

const COURT = "#033d26";
const LINE = "rgba(244,250,245,0.16)";
const BALL = "#c9f14c";
const BALL_INK = "#152502";
const INK = "#f4faf5";

/** The court is 44 ft long with a 7 ft kitchen either side of the net. */
const PAD = 28;
const COURT_W = size.width - PAD * 2;
const COURT_H = size.height - PAD * 2;
const KITCHEN_L = PAD + (COURT_W * 15) / 44;
const KITCHEN_W = (COURT_W * 14) / 44;

/**
 * The site's faces: Barlow Condensed for headings, Barlow for the rest.
 * Fetched as TTF (the renderer can't read woff2) through the Google Fonts CSS
 * API, which serves TTF to clients that don't announce woff2 support. If the
 * fetch fails the card still renders in the default face.
 */
async function loadFonts() {
  const css = await fetch(
    "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Barlow:wght@500",
  ).then((r) => r.text());
  const url = (family: string) =>
    css.match(
      new RegExp(`font-family: '${family}';[^}]*?src: url\\((.+?)\\)`),
    )?.[1];
  const [condensed, body] = await Promise.all(
    ["Barlow Condensed", "Barlow"].map(async (family) => {
      const src = url(family);
      if (!src) throw new Error(`No font URL for ${family}`);
      return fetch(src).then((r) => r.arrayBuffer());
    }),
  );
  return [
    { name: "Barlow Condensed", data: condensed, weight: 700 as const, style: "normal" as const },
    { name: "Barlow", data: body, weight: 500 as const, style: "normal" as const },
  ];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const [tournament, fonts] = await Promise.all([
    getTournamentByPublicRef(code),
    loadFonts().catch(() => undefined),
  ]);
  const HEADING = fonts ? "Barlow Condensed" : "sans-serif";
  const categories = tournament
    ? await getPublicCategories(tournament.id)
    : [];

  const name = tournament?.name ?? "Sortbrite";
  const dates = categories.some((c) => c.event_date)
    ? formatEventDates(categories.map((c) => c.event_date))
    : null;
  const live = categories.some(
    (c) => c.status === "group_stage" || c.status === "final_stage",
  );
  const registering =
    !live &&
    categories.some((c) => c.status === "draft" && c.registration_open);
  const shownCategories = categories.slice(0, 4);
  const moreCategories = categories.length - shownCategories.length;

  // Long names have to shrink or they overflow the card.
  const nameSize = name.length > 48 ? 80 : name.length > 28 ? 100 : 124;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: COURT,
          color: INK,
          fontFamily: fonts ? "Barlow" : "sans-serif",
        }}
      >
        {/* ---------- the court ---------- */}
        <div
          style={{
            position: "absolute",
            left: KITCHEN_L,
            top: PAD,
            width: KITCHEN_W,
            height: COURT_H,
            backgroundColor: "rgba(244,250,245,0.05)",
            borderLeft: `3px solid ${LINE}`,
            borderRight: `3px solid ${LINE}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: PAD,
            top: PAD,
            width: COURT_W,
            height: COURT_H,
            border: `3px solid ${LINE}`,
          }}
        />
        {/* Centre lines, baseline to kitchen on each side */}
        <div
          style={{
            position: "absolute",
            left: PAD,
            top: PAD + COURT_H / 2,
            width: KITCHEN_L - PAD,
            height: 3,
            backgroundColor: LINE,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: KITCHEN_L + KITCHEN_W,
            top: PAD + COURT_H / 2,
            width: KITCHEN_L - PAD,
            height: 3,
            backgroundColor: LINE,
          }}
        />
        {/* The net */}
        <div
          style={{
            position: "absolute",
            left: size.width / 2 - 2,
            top: PAD - 8,
            width: 0,
            height: COURT_H + 16,
            borderLeft: "5px dashed rgba(201,241,76,0.4)",
          }}
        />

        {/* ---------- the copy ---------- */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "64px 72px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 34,
                  backgroundColor: BALL,
                  marginRight: 14,
                }}
              />
              <div
                style={{
                  fontFamily: HEADING,
                  fontSize: 38,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Sortbrite
              </div>
            </div>
            {(live || registering) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 22px",
                  borderRadius: 999,
                  backgroundColor: BALL,
                  color: BALL_INK,
                  fontFamily: HEADING,
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {live ? "Live now" : "Registration open"}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontFamily: HEADING,
                fontSize: nameSize,
                fontWeight: 700,
                lineHeight: 0.95,
                textTransform: "uppercase",
              }}
            >
              {name}
            </div>
            {(dates || tournament?.location) && (
              <div
                style={{
                  display: "flex",
                  marginTop: 26,
                  fontSize: 34,
                  color: "rgba(244,250,245,0.85)",
                }}
              >
                {dates && <span style={{ color: BALL }}>{dates}</span>}
                {dates && tournament?.location && (
                  <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
                )}
                {tournament?.location && <span>{tournament.location}</span>}
              </div>
            )}
            {shownCategories.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 28 }}>
                {shownCategories.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      padding: "8px 20px",
                      marginRight: 12,
                      marginBottom: 8,
                      borderRadius: 999,
                      border: "2px solid rgba(244,250,245,0.25)",
                      backgroundColor: "rgba(244,250,245,0.08)",
                      fontSize: 24,
                    }}
                  >
                    {c.name}
                  </div>
                ))}
                {moreCategories > 0 && (
                  <div
                    style={{
                      display: "flex",
                      padding: "8px 20px",
                      fontSize: 24,
                      color: "rgba(244,250,245,0.7)",
                    }}
                  >
                    +{moreCategories} more
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 26,
              color: "rgba(244,250,245,0.7)",
            }}
          >
            <div style={{ display: "flex" }}>
              Live standings · Schedule · Registration
            </div>
            <div style={{ display: "flex", color: BALL }}>
              sortbrite.com/{tournament?.short_code ?? code}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
      headers: {
        // Crawlers refetch previews often; let the CDN answer most of them.
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
