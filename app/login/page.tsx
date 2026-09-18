import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/session";
import { getUsers } from "@/lib/users";
import { LoginForm } from "./login-form";

/*
 * Fake sign-in, outside the dashboard group so there is no sidebar or navbar.
 * The form matches what is typed against the users list in the browser and
 * sets a plain cookie; see lib/fake-session.ts for why that is only a
 * placeholder. Already signed in? Straight to the dashboard.
 */

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");

  const users = await getUsers();

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
          <p className="mt-1 text-center text-sm text-fg-muted">
            Placeholder sign-in: any user on the Users page, with their dummy password.
          </p>
          <LoginForm
            // Only what the match needs; the password is dummy data already in git.
            users={users.map(({ id, email, password, status }) => ({ id, email, password, status }))}
          />
        </div>
      </main>
    </div>
  );
}
