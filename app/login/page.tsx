import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./login-form";

/*
 * Sign-in, outside the dashboard group so there is no sidebar or navbar.
 * The form posts to the `login` server action (./actions.ts), which asks the
 * API for a token pair and stores it in HttpOnly cookies. Already signed in?
 * Staff go to the CRM home at /overview; an agent goes to their view at /agent.
 */

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.agentId ? "/agent" : "/overview");

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div aria-hidden="true" className="bg-brand-gradient h-0.5" />
      <div className="flex justify-end px-4 pt-3 sm:px-6">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex justify-center">
            <BrandLogo height={40} />
          </div>
          <h1 className="mt-6 text-center text-lg font-semibold text-fg">Sign in</h1>

          <LoginForm />
        </div>
      </main>
    </div>
  );
}
