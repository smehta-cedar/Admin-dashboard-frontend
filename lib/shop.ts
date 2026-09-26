/*
 * The public tee shop's copy, options and pure validation. Client-safe: the
 * shop view (app/shop/shop-view.tsx) imports this, never the server action's
 * file helpers, and the action (app/shop/actions.ts) runs the same
 * `validateOrder` again so a direct POST cannot skip it.
 *
 * One product, no payment: an order is a pending HR request (lib/requests.ts,
 * the merch variant) that the office confirms by hand.
 */

export const TEE = {
  name: "Cedar Grove Tee",
  description:
    "Soft ring-spun cotton with the Cedar Grove pinecone on the chest. Unisex fit, pre-shrunk.",
  /** Whole dollars; shown as `priceLabel`. */
  price: 28,
  priceLabel: "$28",
} as const;

export type TeeColor = {
  id: string;
  label: string;
  /** Fill for the preview and the swatch. */
  hex: string;
};

export const TEE_COLORS: readonly TeeColor[] = [
  { id: "teal", label: "Teal", hex: "#37b38f" },
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "navy", label: "Navy", hex: "#1f2a44" },
];

export const TEE_SIZES: readonly string[] = ["S", "M", "L", "XL", "XXL"];

export const MAX_QUANTITY = 10;

/** Everything the two steps collect, as strings from the form except the count. */
export type OrderValues = {
  size: string;
  color: string;
  quantity: number;
  buyerName: string;
  email: string;
  phone: string;
  address: string;
};

/** A validation error, shown under the field it names. */
export type OrderError = {
  field: keyof OrderValues;
  message: string;
};

export const colorLabel = (id: string) => TEE_COLORS.find((color) => color.id === id)?.label ?? id;

/**
 * Checks a whole order. Selection first (the choose step), then the buyer's
 * details, so the first error found is the earliest field on the page.
 */
export function validateOrder(values: OrderValues): OrderError | null {
  if (!TEE_COLORS.some((color) => color.id === values.color)) {
    return { field: "color", message: "Choose a color." };
  }
  if (!TEE_SIZES.includes(values.size)) return { field: "size", message: "Choose a size." };
  if (!Number.isInteger(values.quantity) || values.quantity < 1 || values.quantity > MAX_QUANTITY) {
    return { field: "quantity", message: `Enter a quantity from 1 to ${MAX_QUANTITY}.` };
  }
  if (!values.buyerName.trim()) return { field: "buyerName", message: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return { field: "email", message: "Enter a valid email address." };
  }
  if (values.phone.replace(/\D/g, "").length < 10) {
    return { field: "phone", message: "Enter a phone number with area code." };
  }
  if (!values.address.trim()) return { field: "address", message: "Enter a shipping address." };
  return null;
}
