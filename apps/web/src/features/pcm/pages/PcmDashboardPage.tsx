import { ClipboardList, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { montarDashboardPcm } from "../domain/dashboard-pcm";
import type { DashboardPcmResumo, KpiDashboardPcm } from "../domain/dashboard-pcm";
import {
  PRIORIDADE_LABEL,
  prioridadeColor,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dashboard: DashboardPcmResumo };

export function PcmDashboardPage({
  podeCriarOs,
  onNovaOs,
  onVerOrdens,
  onVerBacklog,
}: {
  podeCriarOs: boolean;
  onNovaOs: () => void;
  onVerOrdens: () => void;
  onVerBacklog: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [ordens, inspecoes] = await Promise.all([
        supabaseHubOsAdapter.listarOrdensServico(),
        supabaseQualidadeAdapter.listarInspecoes(),
      ]);
      setEstado({ fase: "pronto", dashboard: montarDashboardPcm(ordens, inspecoes) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar o dashboard.",
      });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando dashboard PCM…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="rounded-[10px] border border-line bg-card p-8 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Dashboard indisponível</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const { dashboard } = estado;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">PCM · Operação</h2>
          <p className="text-sm text-ink-3">
            Dados reais de OS, backlog e inspeções carregados do alvo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {podeCriarOs && (
            <button
              type="button"
              onClick={onNovaOs}
              className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
            >
              <ClipboardList className="w-4 h-4" />
              Nova OS
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {dashboard.kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-[10px] border border-line">
          <div className="px-5 py-4 border-b border-line-soft flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Ordens de Serviço Recentes</h3>
              <p className="text-xs text-ink-3 mt-0.5">Últimas 5 OS registradas no PCM</p>
            </div>
            <button
              type="button"
              onClick={onVerOrdens}
              className="text-xs text-orange font-medium hover:underline"
            >
              Ver todas →
            </button>
          </div>
          <div className="divide-y divide-line-soft">
            {dashboard.ordensRecentes.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-3">
                Nenhuma OS cadastrada ainda.
              </div>
            ) : (
              dashboard.ordensRecentes.map((ordem) => (
                <div
                  key={ordem.id}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-line-soft transition-colors"
                >
                  <span className="text-xs font-brand tabular-nums text-ink-3 w-16 shrink-0">
                    {ordem.numero}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{ordem.titulo}</p>
                    <p className="text-xs text-ink-3 truncate">{ordem.clienteNome}</p>
                  </div>
                  <span
                    className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${prioridadeColor(ordem.prioridade)}`}
                  >
                    {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                  </span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusOsColor(ordem.status)}`}
                  >
                    {rotuloStatusOs(ordem.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card rounded-[10px] border border-line">
          <div className="px-5 py-4 border-b border-line-soft flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Top Backlog GUT</h3>
              <p className="text-xs text-ink-3 mt-0.5">OS abertas com maior score</p>
            </div>
            <button
              type="button"
              onClick={onVerBacklog}
              className="text-xs text-orange font-medium hover:underline"
            >
              Ver fila →
            </button>
          </div>
          <div className="divide-y divide-line-soft">
            {dashboard.topBacklog.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-3">
                Nenhuma OS aberta no backlog.
              </div>
            ) : (
              dashboard.topBacklog.map((ordem, indice) => (
                <div key={ordem.id} className="px-5 py-4 flex gap-3 hover:bg-line-soft">
                  <span className="text-xl font-bold font-brand text-line shrink-0 w-5 text-center leading-none mt-0.5">
                    {indice + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink-2 leading-snug">{ordem.titulo}</p>
                    <p className="text-xs text-ink-3 mt-1">{ordem.clienteNome}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-bold font-brand text-ink-2">
                        Score {ordem.scorePcm}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prioridadeColor(ordem.prioridade)}`}
                      >
                        {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: KpiDashboardPcm }) {
  return (
    <div className="bg-card rounded-[6px] border border-line p-5 flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-[0.16em] font-brand">
        {kpi.label}
      </span>
      <span className="text-[28px] font-bold text-ink tabular-nums font-brand leading-none mt-0.5">
        {kpi.valor}
      </span>
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
          kpi.trend === "up"
            ? "text-[#1E8E45]"
            : kpi.trend === "down"
              ? "text-[#C5362B]"
              : "text-ink-3"
        }`}
      >
        {kpi.trend === "up" && <TrendingUp className="w-3 h-3" />}
        {kpi.trend === "down" && <TrendingDown className="w-3 h-3" />}
        {kpi.sub}
      </span>
    </div>
  );
}
