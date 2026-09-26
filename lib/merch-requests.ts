import "server-only";

/*
 * The one JSON file the app writes to: tee orders from the public shop,
 * appended by the shop's server action (app/shop/actions.ts). Read with fs
 * at request time rather than imported, so a row added while the server is
 * running shows on the next HR load instead of the build's snapshot. Every
 * other list is still read-only JSON in git; this one is too, but grows.
 * Supabase replaces it along with the rest.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MerchRequestRecord } from "@/lib/requests";

/** Resolved from the working directory, which `next dev` and `next start` set to frontend/. */
const FILE = path.join(process.cwd(), "data", "merch-requests.json");

/** Every filed order, in file order. A missing or empty file reads as none. */
export async function readMerchRequests(): Promise<MerchRequestRecord[]> {
  let text: string;
  try {
    text = await readFile(FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (!text.trim()) return [];
  return JSON.parse(text) as MerchRequestRecord[];
}

/** Appends one order and rewrites the file, pretty-printed like the others in data/. */
export async function appendMerchRequest(record: MerchRequestRecord): Promise<void> {
  const existing = await readMerchRequests();
  await writeFile(FILE, `${JSON.stringify([...existing, record], null, 2)}\n`, "utf8");
}
