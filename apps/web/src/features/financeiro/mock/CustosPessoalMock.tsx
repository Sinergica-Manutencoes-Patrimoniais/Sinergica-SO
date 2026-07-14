import { Plus } from "lucide-react";
import { PageHeader, TableShell } from "./MockUi";
import { FUNCIONARIOS, brl } from "./mock-data";

export function CustosPessoalMock() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Custos de pessoal"
        subtitle="Custo mensal → R$/hora derivado, por vigência."
        actions={
          <button type="button" className="btn-accent">
            <Plus className="h-4 w-4" />
            Novo registro
          </button>
        }
      />
      <TableShell
        head={
          <>
            <th className="px-4 py-3">Funcionário</th>
            <th className="px-4 py-3 text-right">Custo mensal</th>
            <th className="px-4 py-3 text-right">Horas-base/mês</th>
            <th className="px-4 py-3 text-right">R$/hora</th>
            <th className="px-4 py-3">Vigente desde</th>
          </>
        }
      >
        {FUNCIONARIOS.map((f) => (
          <tr key={f.nome}>
            <td className="px-4 py-3 font-medium text-ink">{f.nome}</td>
            <td className="px-4 py-3 text-right tabular-nums text-ink">{brl(f.custo)}</td>
            <td className="px-4 py-3 text-right tabular-nums text-ink-2">{f.horas}h</td>
            <td className="px-4 py-3 text-right tabular-nums font-mono text-ink">
              {brl(f.custo / f.horas)}
            </td>
            <td className="px-4 py-3 text-ink-3">
              {f.desde.split("-").reverse().slice(1).join("/")}
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
