"use server";

/*
 * Files a tee order from the public shop. No sign-in: anyone can order, so
 * the action trusts nothing from the form and re-runs the same validation
 * the view ran. The order is appended to data/merch-requests.json as a
 * pending merch request (lib/merch-requests.ts), which the dashboard layout
 * loads with the rest for the HR page. No email goes out: the office
 * follows up on the request by hand.
 */

import { nextId } from "@/lib/change-notes";
import { appendMerchRequest } from "@/lib/merch-requests";
import { formatPhone } from "@/lib/phone";
import { getRequests, type MerchRequestRecord } from "@/lib/requests";
import { validateOrder, type OrderError, type OrderValues } from "@/lib/shop";

export type PlaceOrderResult = { ok: true; id: string } | { ok: false; error: OrderError };

export async function placeOrder(input: OrderValues): Promise<PlaceOrderResult> {
  // Coerce before checking: the wire can carry anything.
  const values: OrderValues = {
    size: String(input.size ?? ""),
    color: String(input.color ?? ""),
    quantity: Number(input.quantity),
    buyerName: String(input.buyerName ?? "").trim(),
    email: String(input.email ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    address: String(input.address ?? "").trim(),
  };
  const error = validateOrder(values);
  if (error) return { ok: false, error };

  // IDs run across both request files, so the HR table never sees two alike.
  const record: MerchRequestRecord = {
    id: nextId(await getRequests()),
    type: "merch",
    status: "pending",
    createdAt: new Date().toISOString(),
    buyerName: values.buyerName,
    email: values.email,
    phone: formatPhone(values.phone),
    address: values.address,
    size: values.size,
    color: values.color,
    quantity: values.quantity,
  };
  await appendMerchRequest(record);

  return { ok: true, id: record.id };
}
