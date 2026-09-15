import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getCarriers } from "@/lib/commissions";

export const metadata: Metadata = {
  title: "Carriers",
};

export default async function CarriersPage() {
  const carriers = await getCarriers();

  return (
    <>
      <PageHeader
        title="Carriers"
        description="Insurance carriers on the commission statements."
      />
      {carriers.length === 0 ? (
        <EmptyState
          title="No carriers yet"
          description="Carriers will appear here once commission statements are loaded."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium text-gray-600">
                  Name
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium text-gray-600">
                  Code
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-t border-gray-200">
              {carriers.map((carrier) => (
                <tr key={carrier.code}>
                  <td className="px-4 py-2.5 text-gray-900">{carrier.name}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-600">{carrier.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
