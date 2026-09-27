import { redirect } from "next/navigation";
import { API_URL } from "@/lib/api";
import { accessToken } from "@/lib/api-server";

/*
 * Downloads a certification's PDF: GET /certifications/{id}/file streams
 * the API's GET /certifications/{id}/file/ to the browser as the signed-in
 * user. The browser never holds a token and the API keeps the file private,
 * so this is the only way to the file; the tables link here.
 *
 * The API needs certifications view and answers 404 when the row has no
 * file; either comes back as a plain-text page with the API's message. A
 * session that is gone goes back to sign in.
 */

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await accessToken();
  if (!token) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${API_URL}/certifications/${encodeURIComponent(id)}/file/`, {
      // JSON too, so the API can still answer an error in its envelope.
      headers: { Accept: "application/pdf, application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Can't reach the server. Please try again.", { status: 502 });
  }

  if (response.status === 401) redirect("/login");
  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    return new Response(payload?.message ?? "Couldn't download the file.", {
      status: response.ok ? 502 : response.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const headers = new Headers({ "Content-Type": "application/pdf", "Cache-Control": "private, no-store" });
  const disposition = response.headers.get("Content-Disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  const length = response.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);
  return new Response(response.body, { headers });
}
