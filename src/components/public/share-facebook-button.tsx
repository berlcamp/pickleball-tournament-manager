"use client";

/**
 * Opens Facebook's share dialog for the portal page being viewed. Facebook
 * builds the post's preview from the page's `og:` tags (see
 * `app/[code]/portal-metadata.ts`), so only the URL is passed. The URL is read
 * at click time so each tab shares itself, on whatever domain it is served.
 */
export function ShareFacebookButton() {
  function share() {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "facebook-share",
      "width=600,height=640,noopener,noreferrer",
    );
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1877F2] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#166FE5] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/60"
    >
      <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden>
        <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
      </svg>
      Share on Facebook
    </button>
  );
}
