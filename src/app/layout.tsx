import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { siteUrl } from "@/lib/site-url";
import { SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Link previews (Facebook, Messenger, Viber) only follow absolute og: URLs,
  // so every route needs a base to resolve relative metadata against.
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: "%s — PicklePro" },
  description: SITE_DESCRIPTION,
  applicationName: "PicklePro",
  // What organizers actually type when they go looking for this. Search
  // engines mostly ignore the tag now; it costs nothing and some crawlers
  // (and our own AI-summary previews) still read it.
  keywords: [
    "pickleball tournament software",
    "pickleball tournament manager",
    "round robin generator",
    "tournament bracket maker",
    "Challonge alternative",
    "pickleball scheduling",
    "pickleball registration",
    "live standings",
  ],
  category: "sports",
  creator: "Sortbrite",
  publisher: "Sortbrite",
  // The default is already index/follow, but Google's own bot honours the
  // extra image and snippet limits only when they are stated.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // Images are deliberately left unset so the `opengraph-image.png` file
    // convention beside this layout supplies them — and Next copies them onto
    // the twitter card too. The portal overrides both with the banner.
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-app-gradient min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
