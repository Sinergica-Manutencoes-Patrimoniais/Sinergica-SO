import { Plus } from "lucide-react";
import { PageHeader } from "./MockUi";
import { CONTAS, brl } from "./mock-data";

export function ContasBancariasMock() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Contas bancárias"
        subtitle="Saldo derivado do saldo inicial + lançamentos realizados."
        actions={
          <button type="button" className="btn-accent">
            <Plus className="h-4 w-4" />
            Nova conta
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CONTAS.map((c) => (
          <div key={c.nome} className="surface-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-3">
              {c.banco}
            </p>
            <p className="mt-1.5 text-sm font-semibold text-ink">{c.nome}</p>
            <p className="mt-2 text-lg font-bold tabular-nums text-ink">{brl(c.saldo)}</p>
            <p className="mt-0.5 text-[11px] text-ink-3">Saldo atual</p>
          </div>
        ))}
      </div>
    </div>
  );
}
