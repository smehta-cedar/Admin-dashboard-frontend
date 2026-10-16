import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { StatusSectionsView } from "@/components/status-sections-view";
import { canView } from "@/lib/auth-user";
import { getSessionUser } from "@/lib/session";
import { getStatusSections, STATUS_MODULES } from "@/lib/status-sections";

export const metadata: Metadata = {
  title: "Archive",
};

/** Every record no longer in force (inactive, expired or cancelled) the role can see. */
export default async function ArchivePage() {
  const user = await getSessionUser();
  if (!user || !STATUS_MODULES.some((module) => canView(user, module))) return <NoAccess title="Archive" />;

  return (
    <>
      <PageHeader title="Archive" />
      <StatusSectionsView
        sections={await getStatusSections(user, ["inactive", "expired", "cancelled"])}
        empty="Nothing archived"
      />
    </>
  );
}
