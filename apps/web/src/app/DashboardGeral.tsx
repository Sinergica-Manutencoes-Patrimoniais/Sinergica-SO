// E01-S147: dashboard geral da tela Início — extraído de HomePage.tsx (arquivo de alto risco,
// ver docs/STATE.md) pra virar testável isolado. Nesta primeira task só move o componente e o
// mock existentes, sem mudar comportamento; tasks seguintes trocam DASHBOARD_GERAL por dado real
// por módulo.
import { AlertTriangle } from "lucide-react";
import { MODULOS } from "./modulos";
import type { ModuloId } from "./modulos";

export interface ModuloResumo {
  moduloId: ModuloId;
  kpis: Array<{ label: string; valor: string }>;
  alerta?: string;
}

export const DASHBOARD_GERAL: ModuloResumo[] = [
  {
    moduloId: "pcm",
    kpis: [
      { label: "OS Abertas", valor: "12" },
      { label: "SLA no Prazo", valor: "87%" },
      { label: "Backlog", valor: "23 itens" },
    ],
  },
  {
    moduloId: "atendimento",
    kpis: [
      { label: "Chamados hoje", valor: "8" },
      { label: "Pendentes", valor: "3" },
    ],
  },
  {
    moduloId: "comercial",
    kpis: [
      { label: "Leads ativos", valor: "5" },
      { label: "Contratos ativos", valor: "3" },
    ],
  },
  {
    moduloId: "financeiro",
    kpis: [
      { label: "Recebido (mês)", valor: "R$ 48,5k" },
      { label: "Inadimplentes", valor: "1" },
    ],
    alerta: "1 contrato",
  },
  {
    moduloId: "marketing",
    kpis: [
      { label: "Publicações/sem.", valor: "3" },
      { label: "Alcance", valor: "1.2k" },
      { label: "Leads (mês)", valor: "12" },
    ],
  },
  {
    moduloId: "gestao",
    kpis: [
      { label: "Alertas críticos", valor: "0" },
      { label: "Score geral", valor: "94" },
    ],
  },
  {
    moduloId: "area-cliente",
    kpis: [
      { label: "Portais ativos", valor: "15" },
      { label: "OS via portal", valor: "2" },
    ],
  },
];

export function DashboardGeral({
  resumos,
  onSelect,
}: {
  resumos: ModuloResumo[];
  onSelect: (id: ModuloId) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {resumos.map((resumo) => {
        const modulo = MODULOS.find((m) => m.id === resumo.moduloId);
        if (!modulo) return null;
        const Icon = modulo.icon;
        return (
          <div
            key={resumo.moduloId}
            className="group flex min-h-44 flex-col overflow-hidden rounded-xl border border-line bg-card shadow-raised transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-navy/20 hover:shadow-overlay"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 bg-navy px-3.5 py-2.5">
              <div className="w-7 h-7 rounded-md bg-card/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
              </div>
              <span className="text-body font-semibold text-white flex-1 truncate">
                {modulo.label}
              </span>
              {resumo.alerta && (
                <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-micro font-semibold text-warning">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {resumo.alerta}
                </span>
              )}
            </div>

            {/* KPIs */}
            <div className="flex flex-1 flex-col gap-2 px-3.5 py-3">
              {resumo.kpis.map((kpi) => (
                <div key={kpi.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-caption text-ink-3 truncate">{kpi.label}</span>
                  <span className="shrink-0 font-brand text-heading font-bold tabular-nums text-ink">
                    {kpi.valor}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3.5 pb-3">
              <button
                type="button"
                onClick={() => onSelect(resumo.moduloId)}
                className="w-full cursor-pointer rounded-md py-1.5 text-center text-caption font-semibold text-orange transition-colors hover:bg-orange-soft hover:text-orange-deep"
              >
                Ver módulo →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
