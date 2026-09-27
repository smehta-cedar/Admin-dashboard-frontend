"use client";

/**
 * An inline <script> that runs while the server's HTML is parsed, without
 * React's "Encountered a script tag" warning. React warns whenever a render
 * produces a script, because one added on the client never runs. So the
 * server renders a real script and the browser renders it as inert
 * text/plain; suppressHydrationWarning keeps the DOM's already-run version.
 * A client component, so the `typeof window` check runs on each side.
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
