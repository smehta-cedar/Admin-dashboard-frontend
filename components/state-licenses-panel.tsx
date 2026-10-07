import type { ReactNode } from "react";
import { ROW_BUTTON_CLASS } from "@/components/classes";
import { DeleteIcon } from "@/components/delete-icon";
import { EditIcon } from "@/components/edit-icon";
import { LicenseNumber } from "@/components/license-number";
import { Panel, PanelEmpty, ProfileTable } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatLicenceDate, licenceLinesText, type StateLicense } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * A profile's "State licences" panel (agent, agency and carrier): one row
 * per licence — State, Licence #, Lines (agents and carriers: Life, Health or both),
 * Status, Start, End. Dates are formatted from the stored string, never
 * through Date, so the server and the browser agree.
 *
 * Read-only by itself. An agent's rows are edited through the producer form
 * on the profile's Edit button, which updates the rows this renders. The
 * agency edits its rows here: it passes `action` (an Add button for the
 * panel header) and `onEdit`, which puts an Action column first with an
 * icon-only Edit button on every row. `onDelete` adds a Delete icon in
 * that same cell.
 */

type StateLicensesPanelProps = {
  /** The owner's rows, in ID order. */
  licenses: StateLicense[];
  /** Show the Lines column: the agent and carrier profiles, whose rows record Life / Health. */
  showLines?: boolean;
  /** Shown at the right of the panel title, e.g. an Add button. */
  action?: ReactNode;
  /** Given, every row starts with an Edit button that runs this with the row. */
  onEdit?: (license: StateLicense) => void;
  /** Given, every row's Action cell also has a Delete button. */
  onDelete?: (license: StateLicense) => void;
  /** Shown centered in the panel's title row, e.g. a Table | Map switch. */
  center?: ReactNode;
  /** Shown above the table, e.g. a map. */
  beforeTable?: ReactNode;
  className?: string;
};

export function StateLicensesPanel({
  licenses,
  showLines = false,
  action,
  onEdit,
  onDelete,
  center,
  beforeTable,
  className,
}: StateLicensesPanelProps) {
  const columns = [
    ...(onEdit || onDelete ? ["Action"] : []),
    "State",
    "Licence #",
    ...(showLines ? ["Lines"] : []),
    "Status",
    "Start",
    "End",
  ];
  return (
    <Panel title="State licences" count={licenses.length} action={action} center={center} className={className}>
      {beforeTable}
      {licenses.length === 0 ? (
        <PanelEmpty>No state licences recorded.</PanelEmpty>
      ) : (
        <ProfileTable columns={columns} rows={licenses} rowKey={(license) => license.id}>
          {(license) => (
            <>
              {onEdit || onDelete ? (
                <td className="px-3 py-1.5 align-middle whitespace-nowrap">
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(license)}
                      aria-label={`Edit the ${US_STATE_NAMES[license.state] ?? license.state} licence`}
                      title="Edit"
                      className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
                    >
                      <EditIcon className="size-3.5 shrink-0" />
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(license)}
                      aria-label={`Delete the ${US_STATE_NAMES[license.state] ?? license.state} licence`}
                      title="Delete"
                      className={`inline-flex items-center ${ROW_BUTTON_CLASS} hover:text-danger`}
                    >
                      <DeleteIcon className="size-3.5 shrink-0" />
                    </button>
                  ) : null}
                </td>
              ) : null}
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
