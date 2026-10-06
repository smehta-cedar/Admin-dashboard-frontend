import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/** What a page shows when the signed-in user's role can't see its module (lib/access.ts). */
export function NoAccess({ title }: Readonly<{ title: string }>) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        title="No access"
        description="Your role doesn't include this page. Ask an administrator if you need it."
      />
    </>
  );
}
