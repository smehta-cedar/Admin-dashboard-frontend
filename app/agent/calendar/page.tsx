import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canView } from "@/lib/auth-user";
import { getAgentHome } from "@/lib/agent-home";
import { localDateString } from "@/lib/calendar";
import { getSessionUser } from "@/lib/session";
import { AgentCalendarView } from "./agent-calendar-view";

export const metadata: Metadata = {
  title: "Calendar",
};

/**
 * This agent's days off and licence expiries only. Gated by Agent view /
 * My requests. The list and create dialog live in the agent layout's
 * requests store.
 */
export default async function AgentCalendarPage() {
  const user = await getSessionUser();
  if (!user || !canView(user, "agent_view.requests")) {
    return <NoAccess title="Calendar" />;
  }
  const home = await getAgentHome();
  const licenses = home?.licenses ?? [];
  return <AgentCalendarView licenses={licenses} today={localDateString()} />;
}
