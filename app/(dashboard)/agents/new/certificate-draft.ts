import type { CertificationRecord, CertificationStatus } from "@/lib/certifications";
import type { CarrierRef } from "@/lib/policy-types";

/*
 * The certificate rows the agent form page edits. A plain module, not a
 * client one, so the Edit page (a server component) can build the starting
 * rows with draftFromCertification and the client form can use it too.
 */

/** One certification queued for the agent who is about to be created. */
export type CertificateDraft = {
  id: string;
  policyTypeId: string;
  policyTypeName: string;
  /** Carriers covered, in name order; empty unless the type is certified per carrier. */
  carriers: CarrierRef[];
  startDate: string;
  endDate: string;
  isVerified: boolean;
  /** A PDF picked on this page, sent with the next save. Null keeps the stored one. */
  file: File | null;
  /** The stored PDF's name, or null when there is none. */
  fileName: string | null;
  status: CertificationStatus;
};

/** A saved certification as a row of this list. */
export function draftFromCertification(certification: CertificationRecord): CertificateDraft {
  return {
    id: certification.id,
    policyTypeId: certification.policyTypeId,
    policyTypeName: certification.policyTypeName,
    carriers: certification.carriers,
    startDate: certification.startDate,
    endDate: certification.endDate,
    isVerified: certification.isVerified,
    file: null,
    fileName: certification.fileName,
    status: certification.status,
  };
}
