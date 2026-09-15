import type { Metadata } from "next";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getMatrix, type Money, type Month } from "@/lib/commissions";

export const metadata: Metadata = {
  title: "Overview",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats the decimal string directly, so amounts never pass through a float. */
function formatMoney(amount: Money) {
  return usd.format(amount as `${number}`);
}

function formatMonth(month: Month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function OverviewPage() {
  // The month comes from the clock, so render per request, not at build time.
  await connection();

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const matrix = await getMatrix(month);
  const monthLabel = formatMonth(matrix.month);

  if (matrix.grandTotal === null) {
    return (
      <>
        <PageHeader title="Overview" description={monthLabel} />
        <EmptyState
          title="No commissions this month"
          description={`No carrier statements have been loaded for ${monthLabel} yet.`}
        />
      </>
    );
  }

  const missingCarriers = matrix.carriers.filter(
    (carrier) => matrix.carrierTotals[carrier.code] === undefined,
  );
  const reportingCount = matrix.carriers.length - missingCarriers.length;
  const unassigned = matrix.rows.find((row) => row.agent === null);

  const stats = [
    { label: "Total commissions", value: formatMoney(matrix.grandTotal) },
    { label: "Carriers reporting", value: `${reportingCount} of ${matrix.carriers.length}` },
    { label: "Agents paid", value: String(matrix.rows.filter((row) => row.agent !== null).length) },
    { label: "Unassigned", value: unassigned ? formatMoney(unassigned.total) : formatMoney("0.00") },
  ];

  return (
    <>
      <PageHeader title="Overview" description={monthLabel} />

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gray-200 p-4">
            <dt className="text-sm text-gray-600">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {missingCarriers.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-base font-semibold text-gray-900">Missing statements</h2>
          <p className="mt-1 text-sm text-gray-600">
            No data yet for {monthLabel} from these carriers.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {missingCarriers.map((carrier) => (
              <li
                key={carrier.code}
                className="rounded-md bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-800"
              >
                {carrier.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
