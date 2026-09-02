import type { Metadata } from "next";

/**
 * The sign-in page is a client component and so cannot export metadata itself.
 * This layout exists only to keep it out of search results — there is nothing
 * on it worth indexing, and it would otherwise compete with the marketing page.
 */
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
