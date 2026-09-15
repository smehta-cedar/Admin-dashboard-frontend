import { getMatrix } from "@/lib/commissions";

export default async function HomePage() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const matrix = await getMatrix(month);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Commissions</h1>
      <p>{matrix.month}</p>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Agent</th>
            {matrix.carriers.map((carrier) => (
              <th key={carrier.code} style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>
                {carrier.name}
              </th>
            ))}
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.agent?.id ?? "unassigned"}>
              <td style={{ padding: "0.5rem 0.75rem" }}>{row.agent?.name ?? "Unassigned"}</td>
              {matrix.carriers.map((carrier) => (
                <td key={carrier.code} style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>
                  {row.cells[carrier.code] ?? ""}
                </td>
              ))}
              <td style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>{row.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Total</td>
            {matrix.carriers.map((carrier) => (
              <td key={carrier.code} style={{ textAlign: "right", padding: "0.5rem 0.75rem", fontWeight: 600 }}>
                {matrix.carrierTotals[carrier.code] ?? ""}
              </td>
            ))}
            <td style={{ textAlign: "right", padding: "0.5rem 0.75rem", fontWeight: 600 }}>
              {matrix.grandTotal ?? ""}
            </td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}
