/*
 * Phone number formatting. Plain functions, safe to import from client
 * components and from the server-only data modules.
 */

/** Digits only, e.g. "5550104410". Used so search finds a number however it is typed. */
export const phoneDigits = (phone: string) => phone.replace(/\D/g, "");

/**
 * A US number as "(555)010-4410", whatever punctuation it came with; a leading
 * country code 1 is dropped. Anything that isn't 10 digits (an extension, an
 * international number) is returned trimmed, as entered.
 */
export function formatPhone(phone: string): string {
  const digits = phoneDigits(phone).replace(/^1(?=\d{10}$)/, "");
  // A letter means more than punctuation (e.g. "x204"), so leave it alone.
  if (digits.length !== 10 || /[a-z]/i.test(phone)) return phone.trim();
  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
}
