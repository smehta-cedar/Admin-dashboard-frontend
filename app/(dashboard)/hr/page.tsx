import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getAgentStateLicenses } from "@/lib/agent-state-licenses";
import { localDateString } from "@/lib/calendar";
import { HrView } from "./hr-view";

export const metadata: Metadata = {
  title: "HR",
};

/**
 * HR: a month calendar of days off and licence expirations, and every
 * request with its status. Requests and the agent names come from the
 * requests store on the dashboard layout; the licence rows load here. Today's
 * date is worked out on the server (local to the host) and passed down for
 * the first paint; the client realigns to the browser's local day if needed.
 */
export default async function HrPage() {
  if (!(await canViewModule("requests"))) return <NoAccess title="HR" />;
  const licenses = await getAgentStateLicenses();
  const today = localDateString();

  return <HrView licenses={licenses} today={today} />;
}
