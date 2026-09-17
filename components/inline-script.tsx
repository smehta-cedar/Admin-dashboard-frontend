/*
 * A <script> that runs once, while the HTML is parsed, and never again.
 *
 * React warns in development when a render produces a <script> tag. The type
 * swap is the fix Next documents for it (see "Preventing Flash Before
 * Hydration"): the server emits an executable script, and if React ever
 * re-renders the element on the client it emits an inert one, because the
 * script has already done its work by then. `suppressHydrationWarning` covers
 * the resulting type mismatch.
 *
 * Server-only by omission — no "use client" — so `typeof window` is decided
 * when the HTML is built.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
