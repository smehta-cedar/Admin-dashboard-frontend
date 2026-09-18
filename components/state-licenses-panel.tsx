import { Panel, PanelEmpty, ProfileTable } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatLicenceDate, type StateLicense } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * A profile's read-only "State licences" panel (agent and agency): one row per
 * licence — State, Licence #, Status, Start, End. Dates are formatted from the
 * stored string, never through Date, so the server and the browser agree.
 * Editing happens through the producer form on the profile's Edit button,
 * which updates the rows this renders.
 */

type StateLicensesPanelProps = {
  /** The owner's rows, in ID order. */
  licenses: StateLicense[];
  className?: string;
};

const COLUMNS = ["State", "Licence #", "Status", "Start", "End"];

export function StateLicensesPanel({ licenses, className }: StateLicensesPanelProps) {
  return (
    <Panel title="State licences" count={licenses.length} className={className}>
      {licenses.length === 0 ? (
        <PanelEmpty>No state licences recorded.</PanelEmpty>
      ) : (
        <ProfileTable columns={COLUMNS} rows={licenses} rowKey={(license) => license.id}>
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
              <td className="min-w-0 truncate px-3 py-2.5 align-middle font-mono text-fg-muted">
                {license.licenseNumber || <span className="text-fg-faint">No number yet</span>}
              </td>
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
