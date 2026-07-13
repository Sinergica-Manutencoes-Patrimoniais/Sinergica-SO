import { Plus } from "lucide-react";
import { AgingChip, PageHeader, TableShell } from "./MockUi";
import { type FaixaAging, PAGAR, brl, dataCurta } from "./mock-data";

const FAIXAS: Array<{ key: FaixaAging; label: string; cls: string }> = [
  { key: "a-vencer", label: "A vencer", cls: "bg-line-soft" },
  { key: "d7", label: "D+7", cls: "bg-[#FCE3D6] dark:bg-[#3D2417]" },
  { key: "d15", label: "D+15+", cls: "bg-[#FADCD8] dark:bg-[#3E1F1B]" },
];

export function ContasPagarMock() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Contas a pagar"
        subtitle="Fornecedores e despesas fixas — por vencimento."
        actions={
          <button type="button" className="btn-accent">
            <Plus className="h-4 w-4" />
            Nova recorrência
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-2.5">
        {FAIXAS.map((f) => {
          const itens = PAGAR.filter((p) => p.faixa === f.key);
          const total = itens.reduce((s, p) => s + p.valor, 0);
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
            <th className="px-4 py-3">Fornecedor</th>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3">Vencimento</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Situação</th>
            <th className="px-4 py-3" />
          </>
        }
      >
        {PAGAR.map((p) => (
          <tr key={p.desc}>
            <td className="px-4 py-3 font-medium text-ink">{p.forn}</td>
            <td className="px-4 py-3 text-ink-3">{p.desc}</td>
            <td className="px-4 py-3 text-ink-3">{dataCurta(p.venc)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink">
              {brl(p.valor)}
            </td>
            <td className="px-4 py-3">
              <AgingChip faixa={p.faixa} />
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
