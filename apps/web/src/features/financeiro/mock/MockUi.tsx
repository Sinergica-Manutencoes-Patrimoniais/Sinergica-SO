import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import type { FaixaAging } from "./mock-data";

export function MockBanner() {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-[6px] border border-orange-deep/30 bg-orange-soft px-3 py-2 text-xs font-semibold text-orange-deep">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      Protótipo navegável — dados fictícios, nada é gravado. Só pra visualizar telas e dar ideias.
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h2 className="page-title">{title}</h2>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="surface-card p-4">
      {title && <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>}
      {children}
    </div>
  );
}

export function Kpi({
  eyebrow,
  value,
  sub,
  tone,
}: { eyebrow: string; value: string; sub?: string; tone?: "good" | "critical" }) {
  return (
    <div className="surface-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-3">{eyebrow}</p>
      <p
        className={`mt-2 text-xl font-bold tabular-nums tracking-tight ${
          tone === "good" ? "text-[#1E8E45]" : tone === "critical" ? "text-[#C5362B]" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-ink-3">{sub}</p>}
    </div>
  );
}

const AGING_LABEL: Record<FaixaAging, string> = {
  "a-vencer": "A vencer",
  d3: "D+3",
  d7: "D+7",
  d15: "D+15",
};

const AGING_CLASS: Record<FaixaAging, string> = {
  "a-vencer": "bg-line-soft text-ink-2",
  d3: "bg-[#FDF0D3] text-[#8A5A00] dark:bg-[#3A2C0E] dark:text-[#F4C767]",
  d7: "bg-[#FCE3D6] text-[#B04A1F] dark:bg-[#3D2417] dark:text-[#F0A97C]",
  d15: "bg-[#FADCD8] text-[#A23B25] dark:bg-[#3E1F1B] dark:text-[#F2988A]",
};

export function AgingChip({ faixa }: { faixa: FaixaAging }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${AGING_CLASS[faixa]}`}
    >
      {AGING_LABEL[faixa]}
    </span>
  );
}

export function StatusChip({ status }: { status: "previsto" | "realizado" }) {
  return status === "realizado" ? (
    <span className="inline-flex rounded-full bg-[#E7F6EC] px-2 py-0.5 text-[11px] font-semibold text-[#1E8E45] dark:bg-[#12301E] dark:text-[#6FCB8E]">
      Realizado
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-orange-soft px-2 py-0.5 text-[11px] font-semibold text-orange-deep">
      Previsto
    </span>
  );
}

export function TableShell({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line-soft text-sm">
          <thead className="bg-line-soft/60 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-line-soft">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
