/** Trash can. Sized by the caller through `className`; inherits text color. */
export function DeleteIcon({ className }: { className?: string }) {
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
      <path d="M4.5 6h11" />
      <path d="M8 6V4.5h4V6" />
      <path d="M6.5 6.5 7 16h6l.5-9.5" />
      <path d="M9 9v4.5" />
      <path d="M11 9v4.5" />
    </svg>
  );
}
