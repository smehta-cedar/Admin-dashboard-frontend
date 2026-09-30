import type { CarrierRef, CertificationScope, PolicyTypeRecord } from "@/lib/policy-types";

/*
 * What the certification forms offer for a policy type. A plain module, not
 * a server-only or client one, so pages can build the options on the server
 * and the policy types view can rebuild them after a save.
 */

/** A policy type as a certification form offers it. */
export type CertifiablePolicyType = {
  id: string;
  name: string;
  status: "active" | "inactive";
  certificationScope: CertificationScope;
  /**
   * Carriers a certification on this type can cover: its certification
   * carriers that have an agency contract. Empty unless the scope is per_carrier.
   */
  carriers: CarrierRef[];
};

/**
 * `policyType` as a certification form offers it. `contracted` is every
 * carrier with an agency contract, or null when the role can't see agency
 * contracts; then the type's own carriers are offered and the API checks.
 */
export function certifiablePolicyType(policyType: PolicyTypeRecord, contracted: CarrierRef[] | null): CertifiablePolicyType {
  const contractedIds = contracted ? new Set(contracted.map((carrier) => carrier.id)) : null;
  return {
    id: policyType.id,
    name: policyType.name,
    status: policyType.status,
    certificationScope: policyType.certificationScope,
    carriers:
      policyType.certificationScope === "per_carrier"
        ? policyType.certificationCarriers.filter((carrier) => !contractedIds || contractedIds.has(carrier.id))
        : [],
  };
}
