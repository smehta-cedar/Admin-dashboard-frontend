import type { Metadata } from "next";
import { Figtree } from "next/font/google";
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
    <html lang="en" className={figtree.variable}>
      <body className="min-h-screen bg-white font-sans text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
