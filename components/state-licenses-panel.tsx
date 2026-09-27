import { LicenseNumber } from "@/components/license-number";
import { Panel, PanelEmpty, ProfileTable } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatLicenceDate, licenceLinesText, type StateLicense } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * A profile's read-only "State licences" panel (agent and agency): one row per
 * licence — State, Licence #, Lines (agents only: Life, Health or both),
 * Status, Start, End. Dates are formatted from the stored string, never
 * through Date, so the server and the browser agree. Editing happens through
 * the producer form on the profile's Edit button, which updates the rows this
 * renders.
 */

type StateLicensesPanelProps = {
  /** The owner's rows, in ID order. */
  licenses: StateLicense[];
  /** Show the Lines column: the agent profile, whose rows record Life / Health. */
  showLines?: boolean;
  className?: string;
};

export function StateLicensesPanel({ licenses, showLines = false, className }: StateLicensesPanelProps) {
  const columns = ["State", "Licence #", ...(showLines ? ["Lines"] : []), "Status", "Start", "End"];
  return (
    <Panel title="State licences" count={licenses.length} className={className}>
      {licenses.length === 0 ? (
        <PanelEmpty>No state licences recorded.</PanelEmpty>
      ) : (
        <ProfileTable columns={columns} rows={licenses} rowKey={(license) => license.id}>
          {(license) => (
            <>
              <td
                className="px-3 py-2.5 align-middle font-mono font-medium text-fg"
                title={US_STATE_NAMES[license.state]}
              >
                {license.state}
                {US_STATE_NAMES[license.state] ? (
                  <span className="sr-only"> ({US_STATE_NAMES[license.state]})</span>
                ) : null}
              </td>
              <td className="min-w-0 px-3 py-2.5 align-middle">
                <LicenseNumber value={license.licenseNumber} />
              </td>
              {showLines ? (
                <td className="whitespace-nowrap px-3 py-2.5 align-middle text-fg">
                  {licenceLinesText(license) || <span className="text-fg-subtle">—</span>}
                </td>
              ) : null}
              <td className="px-3 py-2.5 align-middle">
                <StatusBadge status={license.status} />
              </td>
              <td className="px-3 py-2.5 align-middle text-fg-muted">
                <time dateTime={license.startDate}>{formatLicenceDate(license.startDate)}</time>
              </td>
              <td className="px-3 py-2.5 align-middle text-fg-muted">
                <time dateTime={license.endDate}>{formatLicenceDate(license.endDate)}</time>
              </td>
            </>
          )}
        </ProfileTable>
      )}
    </Panel>
  );
}
