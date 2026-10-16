import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "../marketing.css";

/*
 * Public marketing site (home, team, careers). Styles come from
 * cg-seniorhealth's stylesheet, scoped under .cg-site so the CRM dashboard
 * is not affected. Fonts match the static site: Plus Jakarta + DM Sans.
 */

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`cg-site ${plusJakarta.variable} ${dmSans.variable}`}>{children}</div>
  );
}
