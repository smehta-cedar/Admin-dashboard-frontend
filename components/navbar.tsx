import Link from "next/link";
import { BrandLogo } from "./brand-logo";

type NavbarProps = {
  title: string;
  /** Opens the mobile drawer. The button is hidden at `lg` and up. */
  onMenuClick: () => void;
  /** Id of the drawer element, for aria-controls. */
  drawerId: string;
};

export function Navbar({ title, onMenuClick, drawerId }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 sm:px-6 lg:pl-0 lg:pr-8">
      {/* Brand strip; absolute so the bar stays h-14. */}
      <div aria-hidden="true" className="bg-brand-gradient absolute inset-x-0 top-0 h-0.5" />
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
      {/* From `lg` this cell matches the sidebar's width, heading the nav rail. */}
      <Link
        href="/"
        className="flex items-center gap-3 self-stretch lg:w-60 lg:shrink-0 lg:border-r lg:border-line lg:bg-surface-muted lg:px-6"
      >
        <span className="sm:hidden">
          <BrandLogo compact height={32} />
        </span>
        <span className="hidden sm:block">
          <BrandLogo height={34} />
        </span>
        <span className="sr-only">{title}</span>
      </Link>
      <span aria-hidden="true" className="hidden text-sm font-semibold tracking-tight text-charcoal sm:block lg:pl-5">
        {title}
      </span>
      {/* Static placeholder until there is auth. */}
      <div className="ml-auto flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink"
        >
          SM
        </span>
        <span className="text-sm font-medium text-gray-900">Sujana</span>
      </div>
    </header>
  );
}
