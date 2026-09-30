"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import type { AgentRecord } from "@/lib/agents";
import type { CertifiablePolicyType } from "@/lib/certification-options";
import { deleteCertification, saveCertification } from "../certifications/actions";
import { saveAgentLicenses } from "./actions";
import { AgentForm, type AgentError, type AgentValues } from "./agent-dialog";
import { useAgentsStore } from "./agents-store";
import { draftFromCertification, type CertificateDraft } from "./new/certificate-draft";
import { CertificateSection } from "./new/certificate-section";

/*
 * Add agent and Edit agent, as a page: the same cards, sticky button bar,
 * and licence / certification lists as Add agent. Edit is this page at
 * /agents/[id]/edit, not a dialog. Cancel and a successful save both return
 * to `returnTo` — the list or the profile, whichever opened the page.
 * Certifications are written after the agent save. A certification that
 * fails leaves the agent saved and that row on the page; the next save
 * updates the same agent.
 */

type AgentFormPageProps = {
  /** Null when the role can't see policy types: the certifications card is left out. */
  policyTypes: CertifiablePolicyType[] | null;
  /** Set on Edit. Leave out for an empty Add form. */
  agent?: AgentRecord;
  /** Certifications already on the agent. Ignored when `policyTypes` is null. */
  initialCertificates?: CertificateDraft[];
  /** Where Cancel and a successful save go. */
  returnTo: string;
};

function sameCertificate(a: CertificateDraft, b: CertificateDraft) {
  return (
    a.policyTypeId === b.policyTypeId &&
    a.carriers.map((carrier) => carrier.id).join() === b.carriers.map((carrier) => carrier.id).join() &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.isVerified === b.isVerified &&
    // A picked PDF always needs sending.
    b.file === null &&
    a.status === b.status
  );
}

export function AgentFormPage({
  policyTypes,
  agent,
  initialCertificates = [],
  returnTo,
}: AgentFormPageProps) {
  const router = useRouter();
  const { apply, commit } = useAgentsStore();
  const id = useId();
  const agentId = useRef(agent?.id);
  // Certifications that already exist on the server, so a later save can patch or delete them.
  const baseline = useRef(new Map(initialCertificates.map((draft) => [draft.id, draft])));
  const [certificates, setCertificates] = useState(initialCertificates);

  const onSave = async (values: AgentValues): Promise<AgentError | null> => {
    const result = await commit(values, agentId.current);
    if (!result.ok) return result.error;
    agentId.current = result.agent.id;

    if (!policyTypes) return null;

    const failed: CertificateDraft[] = [];
    let message: string | null = null;
    const kept: CertificateDraft[] = [];

    // Remove first, so a type that was taken off the list can be added again.
    for (const [certificationId, prior] of baseline.current) {
      if (certificates.some((draft) => draft.id === certificationId)) continue;
      const removed = await deleteCertification(certificationId);
      if (!removed.ok) {
        failed.push(prior);
        message ??= removed.message;
      } else {
        baseline.current.delete(certificationId);
      }
    }

    for (const draft of certificates) {
      const prior = baseline.current.get(draft.id);
      const valuesFor = {
        agentId: result.agent.id,
        policyTypeId: draft.policyTypeId,
        carrierIds: draft.carriers.map((carrier) => carrier.id),
        startDate: draft.startDate,
        endDate: draft.endDate,
        isVerified: draft.isVerified,
        file: draft.file,
        status: draft.status,
      };
      if (!prior) {
        const saved = await saveCertification(valuesFor, "agent");
        if (!saved.ok) {
          kept.push(draft);
          message ??= saved.errors[0]?.message ?? "Couldn't add the certification.";
        } else {
          const stored = draftFromCertification(saved.certification);
          baseline.current.set(stored.id, stored);
          kept.push(stored);
        }
      } else if (!sameCertificate(prior, draft)) {
        const saved = await saveCertification(valuesFor, "agent", draft.id);
        if (!saved.ok) {
          kept.push(draft);
          message ??= saved.errors[0]?.message ?? "Couldn't save the certification.";
        } else {
          const stored = draftFromCertification(saved.certification);
          baseline.current.set(stored.id, stored);
          kept.push(stored);
        }
      } else {
        kept.push(draft);
      }
    }

    setCertificates([...failed, ...kept]);
    if (message) {
      return { field: "form", message: `The agent was saved, but a certification was not. ${message}` };
    }
    return null;
  };

  return (
    <>
      <PageHeader title={agent ? `Edit ${agent.name}` : "Add agent"} />
      <AgentForm
        id={id}
        editing={agent}
        layout="page"
        licenceEntry="button"
        onLicencesChange={async (licences) => {
          // Add agent has no row yet; the list is sent with the form.
          const currentId = agentId.current;
          if (!currentId) return null;
          const saved = await saveAgentLicenses(currentId, licences);
          if (!saved.ok) return saved.error.message;
          apply(saved.agent, saved.licenses);
          return null;
        }}
        pageExtra={
          policyTypes ? (
            <CertificateSection
              idPrefix={id}
              policyTypes={policyTypes}
              drafts={certificates}
              onChange={setCertificates}
              onRemove={async (draft) => {
                if (!baseline.current.has(draft.id)) return null;
                const removed = await deleteCertification(draft.id);
                if (!removed.ok) return removed.message;
                baseline.current.delete(draft.id);
                return null;
              }}
            />
          ) : null
        }
        onSave={onSave}
        close={() => router.push(returnTo)}
      />
    </>
  );
}
