import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShopView } from "./shop-view";

/*
 * Public tee shop, outside the dashboard group: no sidebar, no sign-in.
 * Same chrome as the landing page and sign-in. The two steps and the submit
 * live in ./shop-view.tsx; the order is filed by ./actions.ts.
 */

export const metadata: Metadata = {
  title: "Cedar Grove Tee",
};

export default function ShopPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div aria-hidden="true" className="bg-brand-gradient h-0.5" />
      <header className="flex items-center justify-between px-4 pt-3 sm:px-6">
        <Link href="/" aria-label="Cedar Grove home" className="flex items-center">
          <BrandLogo height={32} />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-8 sm:px-6">
        <ShopView />
      </main>
    </div>
  );
}
