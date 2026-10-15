/**
 * An outline button that reads on the court-green workspace header.
 *
 * Kept in a plain module, not beside the client `SettingsButton`: a server
 * component importing a value from a "use client" file gets a client
 * reference instead of the string, and the button falls back to white.
 */
export const HEADER_BUTTON =
  "border-court-foreground/25 bg-court-foreground/10 text-court-foreground hover:bg-court-foreground/20 hover:text-court-foreground dark:border-court-foreground/25 dark:bg-court-foreground/10";
