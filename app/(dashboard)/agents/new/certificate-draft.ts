import type { CertificationRecord, CertificationStatus } from "@/lib/certifications";

/*
 * The certificate rows the agent form page edits. A plain module, not a
 * client one, so the Edit page (a server component) can build the starting
 * rows with draftFromCertification and the client form can use it too.
 */

/** One certification queued for the agent being added or edited. */
export type CertificateDraft = {
  id: string;
  /** "" for none. */
  carrierId: string;
  carrierName: string;
  /** "" for none. */
  lineOfBusiness: string;
  /** "" lets the API default it to the next deadline. */
  dueDate: string;
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
    carrierId: certification.carrierId,
    carrierName: certification.carrierName,
    lineOfBusiness: certification.lineOfBusiness,
    dueDate: certification.dueDate,
    startDate: certification.startDate,
    endDate: certification.endDate,
    isVerified: certification.isVerified,
    file: null,
    fileName: certification.fileName,
    status: certification.status,
  };
}
