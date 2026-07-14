import { Plus } from "lucide-react";
import { PageHeader, TableShell } from "./MockUi";
import { CONTRATOS, brl } from "./mock-data";

export function ContratosMock() {
  const total = CONTRATOS.filter((c) => c.status === "ativo").reduce((s, c) => s + c.valor, 0);

  return (
    <div className="page-stack">
      <PageHeader
        title="Contratos"
        subtitle="Receita mensal recorrente por cliente."
        actions={
          <button type="button" className="btn-accent">
            <Plus className="h-4 w-4" />
            Novo contrato
          </button>
        }
      />
      <TableShell
        head={
          <>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3 text-right">Valor mensal</th>
            <th className="px-4 py-3">Dia venc.</th>
            <th className="px-4 py-3">Vigência desde</th>
            <th className="px-4 py-3">Status</th>
          </>
        }
      >
        {CONTRATOS.map((c) => (
          <tr key={c.cliente}>
            <td className="px-4 py-3 font-medium text-ink">{c.cliente}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink">
              {brl(c.valor)}
            </td>
            <td className="px-4 py-3 text-ink-3">todo dia {c.dia}</td>
            <td className="px-4 py-3 text-ink-3">
              {c.inicio.split("-").reverse().slice(1).join("/")}
            </td>
            <td className="px-4 py-3">
              {c.status === "ativo" ? (
                <span className="inline-flex rounded-full bg-[#E7F6EC] px-2 py-0.5 text-[11px] font-semibold text-[#1E8E45] dark:bg-[#12301E] dark:text-[#6FCB8E]">
                  Ativo
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                  Suspenso
                </span>
              )}
            </td>
          </tr>
        ))}
      </TableShell>
      <div className="surface-card flex items-center justify-between px-4 py-3 text-sm">
        <span className="text-ink-3">Receita recorrente prevista (contratos ativos)</span>
        <b className="tabular-nums text-ink">{brl(total)}</b>
      </div>
    </div>
  );
}
