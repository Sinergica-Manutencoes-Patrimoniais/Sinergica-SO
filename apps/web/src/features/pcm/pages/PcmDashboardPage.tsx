import {
  AlertTriangle,
  Building2,
  ClipboardList,
  DatabaseZap,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { montarDashboardPcm } from "../domain/dashboard-pcm";
import type { DashboardPcmResumo, KpiDashboardPcm } from "../domain/dashboard-pcm";
import {
  PRIORIDADE_LABEL,
  prioridadeColor,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { supabaseDashboardPcmAdapter } from "../infrastructure/supabase-dashboard-pcm-adapter";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dashboard: DashboardPcmResumo };

export function PcmDashboardPage({
  refreshKey = 0,
  podeCriarOs,
  onNovaOs,
  onVerOrdens,
  onVerBacklog,
}: {
  refreshKey?: number;
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
      const resumoAuvo = await supabaseDashboardPcmAdapter.obterResumoAuvo();
      setEstado({
        fase: "pronto",
        dashboard: montarDashboardPcm(ordens, inspecoes, new Date(), resumoAuvo),
      });
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

  useEffect(() => {
    if (refreshKey > 0) void carregar();
  }, [refreshKey, carregar]);

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
            Dados reais de OS, backlog, inspeções e caches sincronizados do Auvo
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

      {dashboard.auvo && <PainelAuvo dashboard={dashboard.auvo} />}

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

function PainelAuvo({ dashboard }: { dashboard: NonNullable<DashboardPcmResumo["auvo"]> }) {
  const coberturaClientes =
    dashboard.clientesAtivos === 0
      ? 0
      : Math.round((dashboard.clientesSincronizados / dashboard.clientesAtivos) * 100);
  const coberturaEquipamentos =
    dashboard.equipamentosAtivos === 0
      ? 0
      : Math.round((dashboard.equipamentosVinculados / dashboard.equipamentosAtivos) * 100);
  const ultimaAtualizacao = dashboard.ultimaAtualizacao
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(dashboard.ultimaAtualizacao))
    : "sem sync";

  return (
    <section className="bg-card rounded-[10px] border border-line overflow-hidden">
      <div className="px-5 py-4 border-b border-line-soft flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Operação Auvo</h3>
          <p className="text-xs text-ink-3 mt-0.5">
            Clientes, equipe e ativos espelhados da API Auvo · atualização {ultimaAtualizacao}
          </p>
        </div>
        {dashboard.equipamentosSemCliente > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF1DF] px-3 py-1 text-xs font-semibold text-[#B26A00]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {dashboard.equipamentosSemCliente} ativos sem cliente
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 divide-y divide-line-soft lg:grid-cols-[1.2fr_1fr] lg:divide-x lg:divide-y-0">
        <div className="p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            <AuvoResumoItem
              icon={Building2}
              label="Cobertura clientes"
              value={`${coberturaClientes}%`}
              detail={`${dashboard.clientesSincronizados}/${dashboard.clientesAtivos} com Auvo`}
            />
            <AuvoResumoItem
              icon={Wrench}
              label="Ativos vinculados"
              value={`${coberturaEquipamentos}%`}
              detail={`${dashboard.equipamentosVinculados}/${dashboard.equipamentosAtivos}`}
            />
            <AuvoResumoItem
              icon={Users}
              label="Equipe de campo"
              value={String(dashboard.tecnicosAtivos)}
              detail={`${dashboard.equipesTecnicas} equipes/cargos`}
            />
            <AuvoResumoItem
              icon={DatabaseZap}
              label="Cadastro completo"
              value={String(dashboard.clientesComEndereco)}
              detail={`${dashboard.clientesComContato} com contato`}
            />
          </div>
        </div>

        <div className="p-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3">
            Clientes com mais ativos
          </h4>
          {dashboard.topClientesEquipamentos.length === 0 ? (
            <p className="mt-4 text-sm text-ink-3">Nenhum equipamento Auvo vinculado a clientes.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {dashboard.topClientesEquipamentos.map((cliente) => (
                <div
                  key={cliente.auvoId}
                  className="flex items-center justify-between gap-3 border-b border-line-soft pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{cliente.nome}</p>
                    <p className="text-xs text-ink-3">Auvo #{cliente.auvoId}</p>
                  </div>
                  <span className="font-brand text-lg font-bold tabular-nums text-ink">
                    {cliente.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AuvoResumoItem({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-ink-3">
        <Icon className="h-4 w-4 text-orange" />
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <p className="mt-2 font-brand text-2xl font-bold leading-none text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-ink-3">{detail}</p>
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
