/*
 * The shop's types, catalog vocabulary and pure validation. Client-safe:
 * the shop view (app/(dashboard)/storefront/shop/shop-view.tsx) and the
 * Storefront dialog import this, and the shop action (its actions.ts) runs the
 * same `validateSelection` again against the catalog so a direct POST cannot
 * skip it. The products themselves come from the API through
 * lib/storefront.ts (server-only).
 *
 * No payment: an order is a pending HR request (lib/requests.ts, the merch
 * variant) that the office confirms by hand. Buyer contact comes from the
 * signed-in user's profile on the server.
 */

/** The catalog's sections, in nav order. The API's PRODUCT_CATEGORIES. */
export const PRODUCT_CATEGORIES = [
  { id: "womens", label: "Womens" },
  { id: "mens", label: "Mens" },
  { id: "maternity", label: "Maternity" },
  { id: "accessories", label: "Accessories" },
  { id: "holidays", label: "Holidays" },
] as const;

/** The kinds of thing sold, in nav order. The API's PRODUCT_TYPES. */
export const PRODUCT_TYPES = [
  { id: "polos", label: "Polos" },
  { id: "quarter-zips", label: "Quarter Zips" },
  { id: "shirts", label: "Shirts" },
  { id: "pants", label: "Pants" },
  { id: "belts", label: "Belts" },
  { id: "hats", label: "Hats" },
  { id: "backpacks", label: "Backpacks" },
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["id"];
export type ProductType = (typeof PRODUCT_TYPES)[number]["id"];

export const categoryLabel = (id: string) => PRODUCT_CATEGORIES.find((c) => c.id === id)?.label ?? "";
export const typeLabel = (id: string) => PRODUCT_TYPES.find((t) => t.id === id)?.label ?? "";

export type ProductColor = {
  id: string;
  label: string;
  /** Fill for the preview and the swatch, "#rrggbb". */
  hex: string;
};

/**
 * The colours the Storefront dialog offers from a dropdown, so adding one is
 * a pick, not a hex code. A custom colour can still be added with the
 * colour input beside it.
 */
export const COLOR_PRESETS: readonly ProductColor[] = [
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "black", label: "Black", hex: "#111111" },
  { id: "heather-gray", label: "Heather Gray", hex: "#9a9a9a" },
  { id: "charcoal", label: "Charcoal", hex: "#3a3a3a" },
  { id: "navy", label: "Navy", hex: "#1f2a44" },
  { id: "royal-blue", label: "Royal Blue", hex: "#2b5bd7" },
  { id: "light-blue", label: "Light Blue", hex: "#9ec5e8" },
  { id: "teal", label: "Teal", hex: "#37b38f" },
  { id: "forest-green", label: "Forest Green", hex: "#1f5c3a" },
  { id: "olive", label: "Olive", hex: "#6b6b2f" },
  { id: "red", label: "Red", hex: "#c62828" },
  { id: "maroon", label: "Maroon", hex: "#6e1e2b" },
  { id: "orange", label: "Orange", hex: "#e87b1e" },
  { id: "yellow", label: "Yellow", hex: "#f2c94c" },
  { id: "pink", label: "Pink", hex: "#e89ab8" },
  { id: "purple", label: "Purple", hex: "#5b3a8a" },
  { id: "brown", label: "Brown", hex: "#6b4a2b" },
  { id: "tan", label: "Tan", hex: "#c9b48a" },
];

export type ProductStatus = "active" | "inactive";

export type ProductRecord = {
  /** The API's UUID. */
  id: string;
  name: string;
  description: string;
  /** A category id, or "" for none (shown under All only). */
  category: string;
  /** A type id, or "" for none. */
  productType: string;
  /** A link to a picture of it, or "" for the drawn tee. */
  imageUrl: string;
  /** Dollars, e.g. 28 or 28.5. */
  price: number;
  /** "$28" or "$28.50". */
  priceLabel: string;
  /** At least one. */
  colors: ProductColor[];
  /** At least one, in display order. */
  sizes: string[];
  /** The most one order may ask for. */
  maxQuantity: number;
  /** Active products are listed in the shop. */
  status: ProductStatus;
};

/** What the choose step collects before Checkout files the order. */
export type SelectionValues = {
  productId: string;
  size: string;
  /** A colour's id. */
  color: string;
  quantity: number;
};

/** A validation error, shown under the field it names. */
export type SelectionError = {
  field: keyof SelectionValues;
  message: string;
};

export const colorLabel = (product: ProductRecord | undefined, id: string) =>
  product?.colors.find((color) => color.id === id)?.label ?? id;

/**
 * Checks a product selection against the product it is for. No product means
 * the shop has nothing to sell. Buyer contact is filled from the signed-in
 * user on the server, so it is not checked here.
 */
export function validateSelection(
  values: SelectionValues,
  product: ProductRecord | undefined,
): SelectionError | null {
  if (!product || product.id !== values.productId) {
    return { field: "productId", message: "That product isn't available any more." };
  }
  if (!product.colors.some((color) => color.id === values.color)) {
    return { field: "color", message: "Choose a color." };
  }
  if (!product.sizes.includes(values.size)) return { field: "size", message: "Choose a size." };
  if (!Number.isInteger(values.quantity) || values.quantity < 1 || values.quantity > product.maxQuantity) {
    return { field: "quantity", message: `Enter a quantity from 1 to ${product.maxQuantity}.` };
  }
  return null;
}
