import { ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { PageHeader, TableShell } from "./MockUi";
import { RENTABILIDADE, brl } from "./mock-data";

export function RentabilidadeMock() {
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <div className="page-stack">
      <PageHeader
        title="Rentabilidade por cliente"
        subtitle="Receita − custo real (horas × R$/h + despesas). Últimos 30 dias."
      />
      <TableShell
        head={
          <>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3 text-right">Receita</th>
            <th className="px-4 py-3 text-right">Custo</th>
            <th className="px-4 py-3 text-right">Margem</th>
            <th className="px-4 py-3 text-right">Margem %</th>
          </>
        }
      >
        {RENTABILIDADE.map((r) => {
          const margem = r.receita - r.custo;
          const pct = Math.round((margem / r.receita) * 100);
          const expandido = aberto === r.cliente;
          return (
            <Fragment key={r.cliente}>
              <tr
                className="cursor-pointer hover:bg-line-soft/50"
                tabIndex={0}
                onClick={() => setAberto(expandido ? null : r.cliente)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setAberto(expandido ? null : r.cliente);
                  }
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <ChevronRight
                      className={`h-3.5 w-3.5 text-ink-3 transition-transform ${expandido ? "rotate-90" : ""}`}
                    />
                    <span className="font-medium text-ink">{r.cliente}</span>
                    {r.alerta && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-[#FADCD8] px-2 py-0.5 text-[10px] font-semibold text-[#A23B25] dark:bg-[#3E1F1B] dark:text-[#F2988A]">
                        ⚠ margem negativa 2m
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{brl(r.receita)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{brl(r.custo)}</td>
                <td
                  className={`px-4 py-3 text-right tabular-nums font-semibold ${margem < 0 ? "text-[#C5362B]" : "text-[#1E8E45]"}`}
                >
                  {brl(margem)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums font-semibold ${pct < 0 ? "text-[#C5362B]" : "text-ink"}`}
                >
                  {pct}%
                </td>
              </tr>
              {expandido && (
                <tr className="bg-line-soft/40">
                  <td colSpan={5} className="px-4 py-3 pl-9">
                    <div className="flex flex-col gap-1.5">
                      {r.os.map((o) => (
                        <div
                          key={o.id}
                          className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-dashed border-line py-1 text-xs text-ink-2 last:border-0"
                        >
                          <span className="font-mono text-ink-3">{o.id}</span>
                          <span>{o.desc}</span>
                          <span>
                            {o.horas}h × {brl(o.rate)}/h = {brl(o.horas * o.rate)}
                          </span>
                          <span>despesas {brl(o.despesa)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </TableShell>
      <p className="text-xs text-ink-3">Clique numa linha pra ver as OS que compõem o custo.</p>
    </div>
  );
}
