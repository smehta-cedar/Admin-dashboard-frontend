/*
 * A US postal address as an agent's personal contact holds it. Plain type and
 * helpers, safe to import from client components and from the server-only
 * data modules.
 */

export type Address = {
  street: string;
  city: string;
  /** Two-letter code from lib/us-states.ts. */
  state: string;
  /** "78701" or "78701-1234". */
  zip: string;
};

export const ADDRESS_PARTS = ["street", "city", "state", "zip"] as const;

/** "123 Main St, Austin, TX 78701" — how notes, search and the profile show it; "" when none. */
export function formatAddress(address: Address | undefined): string {
  if (!address) return "";
  return [address.street, address.city, `${address.state} ${address.zip}`.trim()]
    .filter(Boolean)
    .join(", ");
}
