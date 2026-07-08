import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { contarAutonomiaIa } from "../application/contar-autonomia-ia";
import { listarConversas } from "../application/listar-conversas";
import type { DashboardAtendimentoResumo, KpiAtendimento } from "../domain/dashboard-atendimento";
import { montarDashboardAtendimento } from "../domain/dashboard-atendimento";
import { supabaseAtendimentoAdapter } from "../infrastructure/supabase-atendimento-adapter";
import { supabaseDashboardAtendimentoAdapter } from "../infrastructure/supabase-dashboard-atendimento-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dashboard: DashboardAtendimentoResumo };

export function AtendimentoDashboardPage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  const temLeitura = podeAcessar("atendimento", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [conversas, autonomiaIa] = await Promise.all([
        listarConversas(supabaseAtendimentoAdapter),
        contarAutonomiaIa(supabaseDashboardAtendimentoAdapter),
      ]);
      setEstado({ fase: "pronto", dashboard: montarDashboardAtendimento(conversas, autonomiaIa) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar o dashboard.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) void carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  if (permissoesCarregando || estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando dashboard…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          Você não tem permissão de leitura no módulo Atendimento.
        </p>
      </div>
    );
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
          <h2 className="text-base font-semibold text-ink">Atendimento</h2>
          <p className="text-sm text-ink-3">Volume de conversas, fila e autonomia do Agente Zé</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {dashboard.kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[10px] border border-line bg-card">
          <div className="border-b border-line-soft px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">Mix de canais</h3>
          </div>
          <div className="divide-y divide-line-soft">
            {dashboard.mixCanais.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-3">Sem conversas ainda.</div>
            ) : (
              dashboard.mixCanais.map((item) => (
                <div key={item.canal} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm capitalize text-ink-2">{item.canal}</span>
                  <span className="text-sm font-semibold text-ink">{item.total}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[10px] border border-line bg-card">
          <div className="border-b border-line-soft px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">Tags mais usadas</h3>
          </div>
          <div className="divide-y divide-line-soft">
            {dashboard.topTags.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-3">
                Nenhuma tag em uso ainda.
              </div>
            ) : (
              dashboard.topTags.map((item) => (
                <div key={item.nome} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-ink-2">{item.nome}</span>
                  <span className="text-sm font-semibold text-ink">{item.total}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: KpiAtendimento }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[6px] border border-line bg-card p-5">
      <span className="font-brand text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {kpi.label}
      </span>
      <span className="font-brand mt-0.5 text-[28px] font-bold leading-none tabular-nums text-ink">
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
        {kpi.trend === "up" && <TrendingUp className="h-3 w-3" />}
        {kpi.trend === "down" && <TrendingDown className="h-3 w-3" />}
        {kpi.sub}
      </span>
    </div>
  );
}
