/** Pencil tip. Sized by the caller through `className`; inherits text color. */
export function EditIcon({ className }: { className?: string }) {
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
      <path d="M13.5 3.5 16.5 6.5 7 16H4v-3z" />
      <path d="M11.5 5.5 14.5 8.5" />
    </svg>
  );
}
