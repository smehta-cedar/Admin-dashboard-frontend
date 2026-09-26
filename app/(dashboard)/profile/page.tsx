import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePasswordButton } from "@/components/change-password-dialog";
import { PageHeader } from "@/components/page-header";
import { Detail, PROFILE_BUTTON_CLASS, ProfileAvatar } from "@/components/profile-shell";
import { getApiUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My profile",
};

/*
 * The signed-in user's own account, as GET /auth/me/ returns it: the "View
 * profile" item of the navbar's account menu. Read-only for now; the API
 * takes a PATCH for the name and phone, and an administrator changes the
 * rest. Change password opens the same dialog as the account menu.
 */

const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const DATE_TIME = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function ProfilePage() {
  // The layout has already gated on this; the cached call costs nothing more.
  const user = await getApiUser();
  if (!user) redirect("/login");

  const name = user.full_name?.trim() || user.email;

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your account as it is on record. Ask an administrator to change your email, role or designation."
        actions={<ChangePasswordButton className={PROFILE_BUTTON_CLASS} />}
      />

      <section className="rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex items-center gap-3.5 border-b border-line px-5 py-4">
          <ProfileAvatar name={name} />
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold tracking-tight text-fg">{name}</p>
            <p className="truncate text-sm text-fg-muted">{user.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 gap-y-3 px-5 py-4 sm:max-w-xl">
          <Detail label="Full name">{user.full_name}</Detail>
          <Detail label="Email">
            <a href={`mailto:${user.email}`} className="hover:text-brand-ink hover:underline">
              {user.email}
            </a>
          </Detail>
          <Detail label="Phone">
            {user.phone ? (
              <a href={`tel:${user.phone}`} className="hover:text-brand-ink hover:underline">
                {user.phone}
              </a>
            ) : null}
          </Detail>
          <Detail label="Role">{user.role?.name}</Detail>
          <Detail label="Designation">{user.designation?.name}</Detail>
          <Detail label="Access">{user.is_superuser ? "Superuser" : "Standard"}</Detail>
          <Detail label="Last signed in">
            {user.last_login ? DATE_TIME.format(new Date(user.last_login)) : null}
          </Detail>
          <Detail label="Member since">{DATE.format(new Date(user.created_at))}</Detail>
        </dl>
      </section>
    </>
  );
}
