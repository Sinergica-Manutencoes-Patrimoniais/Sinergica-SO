import { AgingChip, PageHeader, TableShell } from "./MockUi";
import { type FaixaAging, RECEBIVEIS, brl, dataCurta } from "./mock-data";

const FAIXAS: Array<{ key: FaixaAging; label: string; cls: string }> = [
  { key: "a-vencer", label: "A vencer", cls: "bg-line-soft" },
  { key: "d3", label: "D+3", cls: "bg-[#FDF0D3] dark:bg-[#3A2C0E]" },
  { key: "d7", label: "D+7", cls: "bg-[#FCE3D6] dark:bg-[#3D2417]" },
  { key: "d15", label: "D+15+", cls: "bg-[#FADCD8] dark:bg-[#3E1F1B]" },
];

export function ContasReceberMock() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Contas a receber"
        subtitle="Recorrentes (contrato) + avulsos — aging e baixa."
      />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {FAIXAS.map((f) => {
          const itens = RECEBIVEIS.filter((r) => r.faixa === f.key);
          const total = itens.reduce((s, r) => s + r.valor, 0);
          return (
            <div key={f.key} className={`rounded-[8px] border border-line p-3 ${f.cls}`}>
              <p className="text-[11px] font-bold text-ink-2">{f.label}</p>
              <p className="mt-1.5 text-base font-bold tabular-nums text-ink">{brl(total)}</p>
              <p className="mt-0.5 text-[11px] text-ink-3">
                {itens.length} item{itens.length === 1 ? "" : "s"}
              </p>
            </div>
          );
        })}
      </div>
      <TableShell
        head={
          <>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Origem</th>
            <th className="px-4 py-3">Vencimento</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Situação</th>
            <th className="px-4 py-3" />
          </>
        }
      >
        {RECEBIVEIS.map((r) => (
          <tr key={r.cliente + r.venc}>
            <td className="px-4 py-3 font-medium text-ink">{r.cliente}</td>
            <td className="px-4 py-3 text-ink-3">{r.origem}</td>
            <td className="px-4 py-3 text-ink-3">{dataCurta(r.venc)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink">
              {brl(r.valor)}
            </td>
            <td className="px-4 py-3">
              <AgingChip faixa={r.faixa} />
            </td>
            <td className="px-4 py-3">
              <button type="button" className="btn-secondary">
                Dar baixa
              </button>
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
