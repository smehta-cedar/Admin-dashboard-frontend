"use server";

/*
 * Files a merch order from the dashboard's shop. The action trusts nothing
 * from the form and re-runs the same validation the view ran, against what
 * the shop sells right now. The order goes to the API as a pending merch
 * request (POST /requests/merch/) as the signed-in user, the same way the
 * HR page files every other request, and the HR page lists it with the
 * rest. Admins get a notification; the shop view appends the row into the
 * requests store so an open HR page sees it without a full refresh.
 *
 * A 401 (session gone) sends the user to sign in; any other refusal shows
 * under the form as a plain message.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import { formatPhone } from "@/lib/phone";
import {
  toRequestRecord,
  type ApiRequest,
  type MerchRequestRecord,
} from "@/lib/requests";
import { validateOrder, type OrderError, type OrderValues } from "@/lib/shop";
import { getCatalog } from "@/lib/storefront";

export type PlaceOrderResult =
  | { ok: true; request: MerchRequestRecord }
  | { ok: false; error: OrderError };

export async function placeOrder(input: OrderValues): Promise<PlaceOrderResult> {
  // Coerce before checking: the wire can carry anything.
  const values: OrderValues = {
    productId: String(input.productId ?? ""),
    size: String(input.size ?? ""),
    color: String(input.color ?? ""),
    quantity: Number(input.quantity),
    buyerName: String(input.buyerName ?? "").trim(),
    email: String(input.email ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    address: String(input.address ?? "").trim(),
  };
  // Checked against what the shop sells right now, not what the page was rendered with.
  const products = await getCatalog();
  const error = validateOrder(values, products.find((product) => product.id === values.productId));
  if (error) return { ok: false, error };

  const result = await apiFetch<ApiRequest>("/requests/merch/", {
    method: "POST",
    body: {
      product_id: values.productId,
      buyer_name: values.buyerName,
      email: values.email,
      phone: formatPhone(values.phone),
      address: values.address,
      size: values.size,
      color: values.color,
      quantity: values.quantity,
    },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    console.error(`Shop order failed: ${result.message} (${result.code}).`);
    return {
      ok: false,
      error: {
        field: "buyerName",
        message:
          result.status === 403
            ? "Your account can't place orders."
            : "Orders can't be placed right now. Please try again later.",
      },
    };
  }

  const request = toRequestRecord(result.data);
  if (!request || request.type !== "merch") {
    return {
      ok: false,
      error: { field: "buyerName", message: "Orders can't be placed right now. Please try again later." },
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, request };
}
