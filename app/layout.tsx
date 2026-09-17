import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { THEME_SCRIPT, ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/* Wired to Tailwind's `font-sans` in globals.css. */
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: {
    template: "%s · Commissions",
    default: "Commissions",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The inline script below adds `dark` to this class list before React
    // hydrates, so the server's class string will not match the DOM's.
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <head>
        {/* Runs while <head> is parsed — the saved theme is on <html> before
            the first paint, so there is no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
