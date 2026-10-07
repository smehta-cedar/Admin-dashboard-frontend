import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getPolicyTypes } from "@/lib/policy-types";
import { PolicyTypesView } from "./policy-types-view";

export const metadata: Metadata = {
  title: "Policy types",
};

export default async function PolicyTypesPage() {
  if (!(await canViewModule("policy_types"))) return <NoAccess title="Policy types" />;
  const policyTypes = await getPolicyTypes();
  return <PolicyTypesView initialPolicyTypes={policyTypes} />;
}
