import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { siteUrl } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "PicklePro by Sortbrite — Tournament Manager";
const DESCRIPTION =
  "Run pickleball tournaments with round robin groups, finals brackets, smart scheduling and live public standings.";

export const metadata: Metadata = {
  // Link previews (Facebook, Messenger, Viber) only follow absolute og: URLs,
  // so every route needs a base to resolve relative metadata against.
  metadataBase: new URL(siteUrl()),
  title: { default: TITLE, template: "%s — PicklePro" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "PicklePro by Sortbrite",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
