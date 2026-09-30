/**
 * A PDF picker that looks like an upload control. The native file input sits
 * over the box so choosing a file still works; the box shows "Upload PDF"
 * until a file is chosen, then that file's name.
 */

type PdfUploadProps = {
  id: string;
  /** Included in the form submit when set. */
  name?: string;
  /** The newly chosen file's name. Empty shows "Upload PDF". */
  fileName?: string | null;
  invalid?: boolean;
  describedBy?: string;
  onChange?: (file: File | null) => void;
};

export function PdfUpload({ id, name, fileName, invalid, describedBy, onChange }: PdfUploadProps) {
  return (
    <div className="group relative mt-1">
      <input
        id={id}
        type="file"
        name={name}
        accept=".pdf,application/pdf"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange?.(event.target.files?.[0] ?? null)}
        className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
      />
      <div
        className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm group-hover:border-brand-strong group-hover:bg-brand-soft group-focus-within:border-brand-strong group-focus-within:ring-1 group-focus-within:ring-brand-strong ${
          invalid ? "border-danger-strong bg-danger-soft" : "border-line-strong bg-surface-muted"
        }`}
      >
        <UploadIcon className={`size-4 shrink-0 ${invalid ? "text-danger" : "text-brand-ink"}`} />
        <span className={`min-w-0 truncate ${fileName ? "text-fg" : "text-fg-muted"}`}>{fileName || "Upload PDF"}</span>
      </div>
    </div>
  );
}

/** Arrow into a tray. Sized by the caller through `className`; inherits text color. */
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 12.5V3.5" />
      <path d="M6.5 7 10 3.5 13.5 7" />
      <path d="M4 12.5v2.25A1.25 1.25 0 0 0 5.25 16h9.5A1.25 1.25 0 0 0 16 14.75V12.5" />
    </svg>
  );
}
