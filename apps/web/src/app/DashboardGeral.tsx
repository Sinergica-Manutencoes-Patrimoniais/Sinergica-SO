// E01-S147: dashboard geral da tela Início com dado real por módulo (PCM/Atendimento/Financeiro).
// Cada card real é uma `useQuery` independente — nunca um `Promise.all` — pra um módulo lento ou
// quebrado não travar nem esconder os outros (AC-4/5, spec.md). Módulo sem dado real pronto ainda
// (Comercial/Marketing/Gestão/Área do Cliente, ver spec "Fora de escopo") mostra `EmptyState`
// honesto em vez de número inventado (AC-6) — nunca reintroduzir o antigo `DASHBOARD_GERAL`
// mockado aqui.
import { EmptyState, Skeleton } from "@sinergica/ui";
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useAtendimentoResumoInicio } from "../features/atendimento/application/resumo-inicio-queries";
import { supabaseDashboardAtendimentoAdapter } from "../features/atendimento/infrastructure/supabase-dashboard-atendimento-adapter";
import { useFinanceiroResumoInicio } from "../features/financeiro/application/resumo-inicio-queries";
import { centavosParaReais } from "../features/financeiro/domain/dinheiro";
import { supabaseFinanceiroAdapter } from "../features/financeiro/infrastructure/supabase-financeiro-adapter";
import { usePcmResumoInicio } from "../features/pcm/application/resumo-inicio-queries";
import { supabaseHubOsAdapter } from "../features/pcm/infrastructure/supabase-hub-os-adapter";
import { MODULOS } from "./modulos";
import type { ModuloId } from "./modulos";

const MODULOS_COM_DADO_REAL = new Set<ModuloId>(["pcm", "atendimento", "financeiro"]);

interface CardModuloChromeProps {
  moduloId: ModuloId;
  onSelect: (id: ModuloId) => void;
  children: ReactNode;
}

function CardModuloChrome({ moduloId, onSelect, children }: CardModuloChromeProps) {
  const modulo = MODULOS.find((m) => m.id === moduloId);
  if (!modulo) return null;
  const Icon = modulo.icon;
  return (
    <div className="group flex min-h-44 flex-col overflow-hidden rounded-xl border border-line bg-card shadow-raised transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-navy/20 hover:shadow-overlay">
      <div className="flex items-center gap-2.5 bg-navy px-3.5 py-2.5">
        <div className="w-7 h-7 rounded-md bg-card/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
        </div>
        <span className="text-body font-semibold text-white flex-1 truncate">{modulo.label}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3.5 py-3">{children}</div>
      <div className="px-3.5 pb-3">
        <button
          type="button"
          onClick={() => onSelect(moduloId)}
          className="w-full cursor-pointer rounded-md py-1.5 text-center text-caption font-semibold text-orange transition-colors hover:bg-orange-soft hover:text-orange-deep"
        >
          Ver módulo →
        </button>
      </div>
    </div>
  );
}

function KpiLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-caption text-ink-3 truncate">{label}</span>
      <span className="shrink-0 font-brand text-heading font-bold tabular-nums text-ink">
        {valor}
      </span>
    </div>
  );
}

function ErroCard({ onTentarDeNovo }: { onTentarDeNovo: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <p className="text-caption text-ink-3">Não foi possível carregar este módulo.</p>
      <button
        type="button"
        onClick={onTentarDeNovo}
        className="inline-flex items-center gap-1.5 text-caption font-semibold text-orange hover:text-orange-deep"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Tentar de novo
      </button>
    </div>
  );
}

function SkeletonKpis() {
  return (
    <>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </>
  );
}

function CardPcm({ onSelect }: { onSelect: (id: ModuloId) => void }) {
  const query = usePcmResumoInicio(supabaseHubOsAdapter);
  return (
    <CardModuloChrome moduloId="pcm" onSelect={onSelect}>
      {query.isSuccess ? (
        <>
          <KpiLinha label="OS Abertas" valor={String(query.data.abertas)} />
          <KpiLinha label="Em Execução" valor={String(query.data.emExecucao)} />
          <KpiLinha label="Críticas" valor={String(query.data.criticas)} />
        </>
      ) : query.isError ? (
        <ErroCard onTentarDeNovo={() => query.refetch()} />
      ) : (
        <SkeletonKpis />
      )}
    </CardModuloChrome>
  );
}

function CardAtendimento({ onSelect }: { onSelect: (id: ModuloId) => void }) {
  const query = useAtendimentoResumoInicio(supabaseDashboardAtendimentoAdapter);
  return (
    <CardModuloChrome moduloId="atendimento" onSelect={onSelect}>
      {query.isSuccess ? (
        <>
          <KpiLinha label="Fila sem atendente" valor={String(query.data.filaSemAtendente)} />
          <KpiLinha label="Conversas abertas" valor={String(query.data.conversasAbertas)} />
          <KpiLinha label="Não lidas" valor={String(query.data.naoLidas)} />
        </>
      ) : query.isError ? (
        <ErroCard onTentarDeNovo={() => query.refetch()} />
      ) : (
        <SkeletonKpis />
      )}
    </CardModuloChrome>
  );
}

function CardFinanceiro({ onSelect }: { onSelect: (id: ModuloId) => void }) {
  const query = useFinanceiroResumoInicio(supabaseFinanceiroAdapter);
  return (
    <CardModuloChrome moduloId="financeiro" onSelect={onSelect}>
      {query.isSuccess ? (
        <>
          <KpiLinha
            label="Posição de caixa"
            valor={`R$ ${centavosParaReais(query.data.posicaoCaixaCentavos)}`}
          />
          <KpiLinha
            label="Resultado do mês"
            valor={`R$ ${centavosParaReais(query.data.resultadoMesCentavos)}`}
          />
          <KpiLinha
            label="A receber (30d)"
            valor={`R$ ${centavosParaReais(query.data.aReceber30dCentavos)}`}
          />
        </>
      ) : query.isError ? (
        <ErroCard onTentarDeNovo={() => query.refetch()} />
      ) : (
        <SkeletonKpis />
      )}
    </CardModuloChrome>
  );
}

function CardVazio({
  moduloId,
  onSelect,
}: { moduloId: ModuloId; onSelect: (id: ModuloId) => void }) {
  return (
    <CardModuloChrome moduloId={moduloId} onSelect={onSelect}>
      <EmptyState titulo="Sem dados disponíveis ainda">
        Este módulo ainda não tem visão geral pronta pro Início.
      </EmptyState>
    </CardModuloChrome>
  );
}

export function DashboardGeral({
  moduloIds,
  onSelect,
}: {
  moduloIds: ModuloId[];
  onSelect: (id: ModuloId) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {moduloIds.map((moduloId) => {
        if (!MODULOS_COM_DADO_REAL.has(moduloId)) {
          return <CardVazio key={moduloId} moduloId={moduloId} onSelect={onSelect} />;
        }
        if (moduloId === "pcm") return <CardPcm key={moduloId} onSelect={onSelect} />;
        if (moduloId === "atendimento")
          return <CardAtendimento key={moduloId} onSelect={onSelect} />;
        return <CardFinanceiro key={moduloId} onSelect={onSelect} />;
      })}
    </div>
  );
}
