"use client";

import { useEffect, useState } from "react";

/**
 * A state's licence number: click to copy, with a floating "Copied" /
 * "Couldn't copy" label. No number shows a quiet "No number yet". Used by
 * agent and agency profiles and the Contracts-by-state panel.
 */
export function LicenseNumber({ value, className }: { value: string | undefined; className?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timeout = setTimeout(() => setStatus("idle"), 1500);
    return () => clearTimeout(timeout);
  }, [status]);

  if (!value) {
    return (
      <span className={`font-mono text-xs text-fg-faint ${className ?? ""}`}>No number yet</span>
    );
  }

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <span className="relative inline-flex min-w-0">
      <button
        type="button"
        onClick={copy}
        title={`Licence number ${value} (click to copy)`}
        className={`-mx-1 cursor-pointer truncate rounded-md px-1 py-0.5 font-mono text-xs text-fg hover:bg-surface-hover ${className ?? ""}`}
      >
        <span className="sr-only">Licence number </span>
        {value}
        <span className="sr-only"> (copy)</span>
      </button>
      <span
        aria-live="polite"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap"
      >
        {status !== "idle" ? (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium text-tooltip-fg ${status === "failed" ? "bg-danger-strong" : "bg-tooltip"}`}
          >
            {status === "copied" ? "Copied" : "Couldn't copy"}
          </span>
        ) : null}
      </span>
    </span>
  );
}
