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
  fieldErrors: { email?: string; password?: string; code?: string };
  error: string | null;
};

const NO_ERRORS: LoginState = { fieldErrors: {}, error: null };

/** The agent form's first step. `sentTo` is set once the API took the request. */
export type AgentCodeState = { sentTo: string | null; emailError?: string; error: string | null };

/**
 * Asks the API to email a new one-time code to the agent's work Gmail. The
 * API answers the same whether or not a code went out, so this moves the
 * form on to the code box either way.
 */
export async function requestAgentCode(_previous: AgentCodeState, formData: FormData): Promise<AgentCodeState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { sentTo: null, emailError: "Enter your work Gmail.", error: null };

  const result = await apiRequest("/auth/agent-code/", { method: "POST", body: { email } });
  if (!result.ok) {
    const emailError = result.code === "invalid" ? result.errors?.email?.[0] : undefined;
    return { sentTo: null, emailError, error: emailError ? null : result.message };
  }
  return { sentTo: email, error: null };
}

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
  redirect(result.data.user.agent_id ? "/agent" : "/overview");
}

/**
 * Agent sign-in: work email and the code from the email. No password.
 * Same cookies as staff sign-in, then the agent's own view at /agent.
 */
export async function agentLogin(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !code) {
    return {
      ...NO_ERRORS,
      fieldErrors: {
        email: email ? undefined : "Enter your work Gmail.",
        code: code ? undefined : "Enter your code.",
      },
    };
  }

  const result = await apiRequest<TokenPair & { user: ApiUser }>("/auth/agent-login/", {
    method: "POST",
    body: { email, code },
  });

  if (!result.ok) {
    if (result.code === "invalid" && result.errors) {
      const { email: emailErrors, code: codeErrors, ...rest } = result.errors;
      const other = Object.values(rest).flat()[0];
      return {
        fieldErrors: { email: emailErrors?.[0], code: codeErrors?.[0] },
        error: other ?? (emailErrors?.length || codeErrors?.length ? null : result.message),
      };
    }
    return { ...NO_ERRORS, error: result.message };
  }

  setAuthCookies(await cookies(), { access: result.data.access, refresh: result.data.refresh });
  redirect("/agent");
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
