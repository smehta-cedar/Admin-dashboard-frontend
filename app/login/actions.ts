"use server";

/*
 * Sign in and sign out, run on the Next server so the tokens never reach the
 * browser's JavaScript. Both write the HttpOnly cookies (lib/auth-cookies.ts)
 * and redirect; a server action is one of the two places Next allows cookies
 * to be set.
 *
 * What the login endpoint answers, and what the form shows for it:
 *
 *   400 invalid              a field is missing, blank or not an email -> under that field
 *   401 invalid_credentials  unknown email or wrong password            -> the API's message
 *   403 account_blocked      right password, blocked account            -> the API's message
 *   429 throttled            10 attempts a minute per IP                -> the API's message
 *   network_error            the API is down                            -> "Can't reach the server."
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiRequest, type TokenPair } from "@/lib/api";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "@/lib/auth-cookies";
import type { ApiUser } from "@/lib/auth-user";

/** Messages for the form: one per field where the API named it, otherwise one for the whole form. */
export type LoginState = {
  fieldErrors: { email?: string; password?: string };
  error: string | null;
};

const NO_ERRORS: LoginState = { fieldErrors: {}, error: null };

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  // Not trimmed: spaces and case matter in a password.
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return {
      ...NO_ERRORS,
      fieldErrors: {
        email: email ? undefined : "Enter your email.",
        password: password ? undefined : "Enter your password.",
      },
    };
  }

  const result = await apiRequest<TokenPair & { user: ApiUser }>("/auth/login/", {
    method: "POST",
    body: { email, password },
  });

  if (!result.ok) {
    if (result.code === "invalid" && result.errors) {
      // A 400 names the fields; each message goes under its own input, anything else under the form.
      const { email: emailErrors, password: passwordErrors, ...rest } = result.errors;
      const other = Object.values(rest).flat()[0];
      return {
        fieldErrors: { email: emailErrors?.[0], password: passwordErrors?.[0] },
        error: other ?? (emailErrors?.length || passwordErrors?.length ? null : result.message),
      };
    }
    // Wrong credentials, blocked account, throttled, API down: about the attempt, not one field.
    return { ...NO_ERRORS, error: result.message };
  }

  setAuthCookies(await cookies(), { access: result.data.access, refresh: result.data.refresh });
  redirect("/overview");
}

/**
 * Blacklists the refresh token on the API, clears both cookies and goes to
 * the sign-in page. The API call is best effort: the cookies go either way,
 * and an access token left in the wild dies on its own within 30 minutes.
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    await apiRequest("/auth/logout/", { method: "POST", body: { refresh } });
  }
  clearAuthCookies(cookieStore);
  redirect("/login");
}
