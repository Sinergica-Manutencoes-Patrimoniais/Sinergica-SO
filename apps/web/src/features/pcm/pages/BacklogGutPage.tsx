import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { Tooltip } from "../../../components/ui/Tooltip";
import { listarBacklogGut, planejarOrdemServico } from "../application/hub-os";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import {
  PRIORIDADE_LABEL,
  prioridadeColor,
  resumoTooltipOrdem,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; ordens: OrdemServicoOperacional[] };

export function BacklogGutPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      setEstado({ fase: "pronto", ordens: await listarBacklogGut(supabaseHubOsAdapter) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar backlog.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const resumo = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    return {
      total: estado.ordens.length,
      criticas: estado.ordens.filter((ordem) => ordem.prioridade === "critica").length,
      maiorScore: estado.ordens[0]?.scorePcm ?? 0,
    };
  }, [estado]);

  async function onPlanejar(ordem: OrdemServicoOperacional) {
    if (!user) return;
    setSalvandoId(ordem.id);
    setErroAcao(null);
    try {
      await planejarOrdemServico(supabaseHubOsAdapter, { id: ordem.id, updatedBy: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível planejar OS.");
    } finally {
      setSalvandoId(null);
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-sm text-ink-3 mt-1">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando backlog…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-sm text-ink-3 mt-1">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Backlog GUT</h2>
          <p className="text-sm text-ink-3">
            OS abertas priorizadas por gravidade, urgência e tendência
          </p>
        </div>
        <button type="button" onClick={carregar} className="btn-secondary">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      {resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Resumo label="OS abertas" valor={resumo.total} />
          <Resumo label="Críticas" valor={resumo.criticas} />
          <Resumo label="Maior score" valor={resumo.maiorScore} />
        </div>
      )}

      <section className="bg-card rounded-[10px] border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line-soft">
          <h3 className="text-sm font-semibold text-ink">Fila priorizada</h3>
          <p className="text-xs text-ink-3 mt-0.5">Maior score aparece primeiro</p>
        </div>

        <div className="divide-y divide-line-soft">
          {estado.ordens.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-3">Nenhuma OS aberta no backlog.</div>
          ) : (
            estado.ordens.map((ordem, index) => (
              <Tooltip key={ordem.id} content={resumoTooltipOrdem(ordem)}>
                <div className="px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex items-center gap-3 lg:w-20">
                    <span className="text-xl font-bold text-line font-brand">{index + 1}</span>
                    <span className="text-xs font-brand tabular-nums text-ink-3">
                      {ordem.numero}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusOsColor(ordem.status)}`}
                      >
                        {rotuloStatusOs(ordem.status)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prioridadeColor(ordem.prioridade)}`}
                      >
                        {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">{ordem.titulo}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {ordem.clienteNome} · {ordem.categoria}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 lg:w-72">
                    <Metric label="G" value={ordem.gravidade ?? 1} />
                    <Metric label="U" value={ordem.urgencia ?? 1} />
                    <Metric label="T" value={ordem.tendencia ?? 1} />
                    <Metric label="Score" value={ordem.scorePcm} />
                  </div>
                  {temEscrita && ordem.status !== "planejamento" && (
                    <button
                      type="button"
                      onClick={() => onPlanejar(ordem)}
                      disabled={salvandoId === ordem.id}
                      className="inline-flex items-center justify-center rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
                    >
                      Planejar
                    </button>
                  )}
                </div>
              </Tooltip>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Resumo({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-[8px] border border-line bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{valor}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[6px] bg-paper px-2 py-1 text-center">
      <p className="text-[10px] font-semibold uppercase text-ink-3">{label}</p>
      <p className="text-sm font-bold text-ink tabular-nums">{value}</p>
    </div>
  );
}
