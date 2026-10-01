import type { Metadata } from "next";
import { getPolicyTypes } from "@/lib/policy-types";
import { PolicyTypesView } from "./policy-types-view";

export const metadata: Metadata = {
  title: "Policy types",
};

export default async function PolicyTypesPage() {
  const policyTypes = await getPolicyTypes();
  return <PolicyTypesView initialPolicyTypes={policyTypes} />;
}
