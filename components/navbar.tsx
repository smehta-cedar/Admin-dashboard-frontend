import Link from "next/link";

type NavbarProps = {
  title: string;
  /** Opens the mobile drawer. The button is hidden at `lg` and up. */
  onMenuClick: () => void;
  /** Id of the drawer element, for aria-controls. */
  drawerId: string;
};

export function Navbar({ title, onMenuClick, drawerId }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-controls={drawerId}
        className="-ml-2 rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>
      <Link href="/" className="text-base font-semibold text-gray-900">
        {title}
      </Link>
    </header>
  );
}
