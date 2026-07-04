import { ClipboardList, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { alterarStatusOrdemServico, listarOrdensServico } from "../application/hub-os";
import type { OrdemServicoOperacional, StatusOrdemServico } from "../domain/ordens-servico";
import {
  PRIORIDADE_LABEL,
  STATUS_OS,
  calcularKpisOrdens,
  prioridadeColor,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; ordens: OrdemServicoOperacional[] };

export function OrdensServicoPage({ onNovaOs }: { onNovaOs: () => void }) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      const ordens = await listarOrdensServico(supabaseHubOsAdapter);
      setEstado({ fase: "pronto", ordens });
      setSelecionadaId((atual) => atual ?? ordens[0]?.id ?? null);
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar OS.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const ordensFiltradas = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    const termo = busca.trim().toLowerCase();
    return estado.ordens.filter((ordem) => {
      const passaStatus = statusFiltro === "todas" || ordem.status === statusFiltro;
      const passaBusca =
        termo.length === 0 ||
        ordem.numero.toLowerCase().includes(termo) ||
        ordem.titulo.toLowerCase().includes(termo) ||
        ordem.clienteNome.toLowerCase().includes(termo);
      return passaStatus && passaBusca;
    });
  }, [estado, busca, statusFiltro]);

  const selecionada = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    return estado.ordens.find((ordem) => ordem.id === selecionadaId) ?? null;
  }, [estado, selecionadaId]);

  const kpis = useMemo(
    () => (estado.fase === "pronto" ? calcularKpisOrdens(estado.ordens) : null),
    [estado],
  );

  async function onAlterarStatus(status: StatusOrdemServico) {
    if (!user || !selecionada) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const atualizada = await alterarStatusOrdemServico(supabaseHubOsAdapter, {
        id: selecionada.id,
        status,
        updatedBy: user.id,
      });
      if (estado.fase === "pronto") {
        setEstado({
          fase: "pronto",
          ordens: estado.ordens.map((ordem) =>
            ordem.id === atualizada.id ? { ...ordem, ...atualizada } : ordem,
          ),
        });
      }
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível alterar status.");
    } finally {
      setSalvando(false);
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
    return <div className="p-8 text-center text-sm text-ink-3">Carregando ordens…</div>;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Ordens de Serviço</h2>
          <p className="text-sm text-ink-3">Fila operacional do PCM com status e sync Auvo</p>
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
          {temEscrita && (
            <button
              type="button"
              onClick={onNovaOs}
              className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
            >
              <ClipboardList className="h-4 w-4" />
              Nova OS
            </button>
          )}
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            ["Total", kpis.total],
            ["Abertas", kpis.abertas],
            ["Planejamento", kpis.emPlanejamento],
            ["Execução", kpis.emExecucao],
            ["Finalizadas", kpis.finalizadas],
            ["Críticas", kpis.criticas],
          ].map(([label, valor]) => (
            <div key={label} className="rounded-[8px] border border-line bg-card px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{valor}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(520px,1fr)_420px] gap-4">
        <section className="bg-card rounded-[10px] border border-line overflow-hidden">
          <div className="px-5 py-4 border-b border-line-soft grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="input md:col-span-2"
              placeholder="Buscar por número, cliente ou título"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
            <select
              className="input"
              value={statusFiltro}
              onChange={(event) => setStatusFiltro(event.target.value)}
            >
              <option value="todas">Todos os status</option>
              {STATUS_OS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-line-soft">
            {ordensFiltradas.length === 0 ? (
              <div className="px-5 py-8 text-sm text-ink-3">Nenhuma OS encontrada.</div>
            ) : (
              ordensFiltradas.map((ordem) => (
                <button
                  key={ordem.id}
                  type="button"
                  onClick={() => setSelecionadaId(ordem.id)}
                  className={`w-full px-5 py-4 text-left hover:bg-line-soft ${
                    ordem.id === selecionadaId ? "bg-line-soft" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-brand tabular-nums text-ink-3">
                      {ordem.numero}
                    </span>
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
                    {ordem.clienteNome} · {ordem.categoria} · score {ordem.scorePcm}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="bg-card rounded-[10px] border border-line min-h-[520px]">
          {selecionada ? (
            <div>
              <div className="px-5 py-4 border-b border-line-soft">
                <p className="text-xs font-brand tabular-nums text-ink-3">{selecionada.numero}</p>
                <h3 className="mt-1 text-lg font-semibold text-ink">{selecionada.titulo}</h3>
                <p className="mt-1 text-sm text-ink-3">{selecionada.clienteNome}</p>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Status" value={rotuloStatusOs(selecionada.status)} />
                  <Info
                    label="Prioridade"
                    value={PRIORIDADE_LABEL[selecionada.prioridade] ?? selecionada.prioridade}
                  />
                  <Info label="Categoria" value={selecionada.categoria} />
                  <Info label="Score GUT" value={String(selecionada.scorePcm)} />
                  <Info
                    label="Fatores"
                    value={`${selecionada.gravidade ?? 1} · ${selecionada.urgencia ?? 1} · ${
                      selecionada.tendencia ?? 1
                    }`}
                  />
                  <Info
                    label="Auvo"
                    value={
                      selecionada.auvoTaskId
                        ? `Task ${selecionada.auvoTaskId}`
                        : selecionada.auvoSyncStatus || "Sem task"
                    }
                  />
                </div>

                {selecionada.auvoSyncError && (
                  <div className="rounded-[8px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A12D24]">
                      Erro Auvo
                    </p>
                    <p className="mt-1 text-sm text-[#7A241D]">{selecionada.auvoSyncError}</p>
                  </div>
                )}

                {temEscrita && (
                  <div className="rounded-[8px] border border-line bg-paper p-3">
                    <label
                      htmlFor="status-os-operacional"
                      className="text-xs font-semibold uppercase tracking-wider text-ink-3"
                    >
                      Alterar status
                    </label>
                    <div className="mt-2 flex gap-2">
                      <select
                        id="status-os-operacional"
                        className="input flex-1"
                        value={selecionada.status}
                        disabled={salvando}
                        onChange={(event) =>
                          onAlterarStatus(event.target.value as StatusOrdemServico)
                        }
                      >
                        {STATUS_OS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 text-xs text-ink-3">
                      Planejamento dispara o gatilho Auvo já existente quando aplicável.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-sm text-ink-3">Selecione uma OS.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-paper px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-medium text-ink">{value}</p>
    </div>
  );
}
