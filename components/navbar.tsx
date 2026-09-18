import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSessionCookie, initials, type SessionUser } from "@/lib/fake-session";
import { BrandLogo } from "./brand-logo";
import { GHOST_BUTTON_CLASS } from "./classes";
import { ThemeToggle } from "./theme-toggle";

type NavbarProps = {
  title: string;
  /** Opens the mobile drawer. The button is hidden at `lg` and up. */
  onMenuClick: () => void;
  /** Id of the drawer element, for aria-controls. */
  drawerId: string;
  /** Mirrors the nav rail so the brand cell stays exactly as wide as it. */
  railCollapsed?: boolean;
  /** The signed-in user: initials, name and role on the right. */
  user: SessionUser;
};

export function Navbar({ title, onMenuClick, drawerId, railCollapsed, user }: NavbarProps) {
  const router = useRouter();

  const signOut = () => {
    clearSessionCookie();
    // The login page and the dashboard gate both read the cookie on the
    // server; refresh so no signed-in render is reused.
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:pl-0 lg:pr-8">
      {/* Brand strip; absolute so the bar stays h-14. */}
      <div aria-hidden="true" className="bg-brand-gradient absolute inset-x-0 top-0 h-0.5" />
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-controls={drawerId}
        className="-ml-2 rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg lg:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>
      {/* From `lg` this cell matches the sidebar's width, heading the nav rail. */}
      <Link
        href="/"
        className={`flex items-center gap-3 self-stretch lg:shrink-0 lg:border-r lg:border-line lg:bg-surface-muted lg:transition-[width] ${
          railCollapsed
            ? "lg:w-16 lg:justify-center lg:px-0"
            : "lg:w-60 lg:px-6"
        }`}
      >
        <span className="sm:hidden">
          <BrandLogo compact height={32} />
        </span>
        <span className="hidden sm:block lg:hidden">
          <BrandLogo height={34} />
        </span>
        {/* The wordmark does not fit a collapsed rail; the mark stands in. */}
        <span className="hidden lg:block">
          {railCollapsed ? <BrandLogo compact height={32} /> : <BrandLogo height={34} />}
        </span>
        <span className="sr-only">{title}</span>
      </Link>
      <span aria-hidden="true" className="hidden text-sm font-semibold tracking-tight text-charcoal sm:block lg:pl-5">
        {title}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink"
        >
          {initials(user.name)}
        </span>
        {/* Name and role give way to just the avatar on narrow screens. */}
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-sm font-medium text-fg">{user.name}</span>
          <span className="block text-xs capitalize text-fg-muted">{user.role}</span>
        </span>
        <span className="sr-only sm:hidden">Signed in as {user.name}</span>
        <button type="button" onClick={signOut} className={`${GHOST_BUTTON_CLASS} whitespace-nowrap`}>
          Sign out
        </button>
      </div>
    </header>
  );
}
