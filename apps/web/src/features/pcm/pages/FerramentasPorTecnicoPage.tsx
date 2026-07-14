import { AlertTriangle, History, RefreshCw, Undo2, UserRound, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  atribuirUnidadeFerramenta,
  devolverUnidadeFerramenta,
  listarHistoricoFuncionario,
  listarUnidadesFerramenta,
} from "../application/ferramenta-unidades";
import { obterFerramentasPorTecnico } from "../application/ferramentas";
import {
  type CondicaoDevolucao,
  type FerramentaUnidadeItem,
  type MovimentacaoFerramentaItem,
  calcularDivergenciaAuvo,
} from "../domain/ferramenta-unidades";
import type {
  FerramentaAlocacaoItem,
  FerramentaItem,
  FuncionarioFerramentaOpcao,
} from "../domain/ferramentas";
import { supabaseFerramentaUnidadesAdapter } from "../infrastructure/supabase-ferramenta-unidades-adapter";
import { supabaseFerramentasAdapter } from "../infrastructure/supabase-ferramentas-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      ferramentas: FerramentaItem[];
      funcionarios: FuncionarioFerramentaOpcao[];
      alocacoesAuvo: FerramentaAlocacaoItem[];
      unidades: FerramentaUnidadeItem[];
    };

export function FerramentasPorTecnicoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [ferramentaId, setFerramentaId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [devolucao, setDevolucao] = useState<FerramentaUnidadeItem | null>(null);
  const [historicoFuncionario, setHistoricoFuncionario] = useState<{
    nome: string;
    itens: MovimentacaoFerramentaItem[];
  } | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [dados, unidades] = await Promise.all([
        obterFerramentasPorTecnico(supabaseFerramentasAdapter),
        listarUnidadesFerramenta(supabaseFerramentaUnidadesAdapter),
      ]);
      setEstado({
        fase: "pronto",
        ferramentas: dados.ferramentas,
        funcionarios: dados.funcionarios,
        alocacoesAuvo: dados.alocacoes,
        unidades,
      });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar ferramentas.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const unidadesDisponiveisDaFerramenta = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    return estado.unidades.filter(
      (unidade) => unidade.ferramentaId === ferramentaId && unidade.status === "disponivel",
    );
  }, [estado, ferramentaId]);

  // Agrupa unidades atribuídas por técnico, e dentro de cada técnico por ferramenta — pra AC-5
  // ("vê as unidades atualmente com ele") e AC-7 (badge de divergência por par ferramenta/técnico).
  const cardsPorTecnico = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    const porTecnico = new Map<
      string,
      { funcionario: FuncionarioFerramentaOpcao; unidades: FerramentaUnidadeItem[] }
    >();
    for (const funcionario of estado.funcionarios) {
      const unidadesDoFuncionario = estado.unidades.filter(
        (unidade) => unidade.atribuidaA === funcionario.id,
      );
      const alocacaoDoFuncionario = estado.alocacoesAuvo.some(
        (alocacao) => alocacao.funcionarioId === funcionario.id,
      );
      if (unidadesDoFuncionario.length > 0 || alocacaoDoFuncionario) {
        porTecnico.set(funcionario.id, { funcionario, unidades: unidadesDoFuncionario });
      }
    }
    return [...porTecnico.values()].sort((a, b) =>
      a.funcionario.nome.localeCompare(b.funcionario.nome),
    );
  }, [estado]);

  function divergenciaDe(funcionarioId: string, ferramentaId: string) {
    if (estado.fase !== "pronto") return null;
    const auvo = estado.alocacoesAuvo.find(
      (item) => item.funcionarioId === funcionarioId && item.ferramentaId === ferramentaId,
    );
    if (!auvo) return null;
    const pcm = estado.unidades.filter(
      (unidade) =>
        unidade.atribuidaA === funcionarioId &&
        unidade.ferramentaId === ferramentaId &&
        unidade.status === "atribuida",
    ).length;
    return calcularDivergenciaAuvo(auvo.quantidade, pcm);
  }

  async function atribuir() {
    if (!user) return;
    try {
      setSalvando(true);
      setErroAcao(null);
      await atribuirUnidadeFerramenta(supabaseFerramentaUnidadesAdapter, {
        unidadeId,
        funcionarioId,
        userId: user.id,
      });
      setUnidadeId("");
      setFuncionarioId("");
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível atribuir a unidade.");
    } finally {
      setSalvando(false);
    }
  }

  async function verHistorico(funcionario: FuncionarioFerramentaOpcao) {
    try {
      const itens = await listarHistoricoFuncionario(
        supabaseFerramentaUnidadesAdapter,
        funcionario.id,
      );
      setHistoricoFuncionario({ nome: funcionario.nome, itens });
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível carregar histórico.");
    }
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Ferramentas por Técnico</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Posse por unidade individual — histórico nunca é sobrescrito (PCM é dono; Auvo é só
              sinal de conferência)
            </p>
          </div>
          {temEscrita && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_minmax(180px,1fr)_auto]">
              <select
                value={ferramentaId}
                onChange={(event) => {
                  setFerramentaId(event.target.value);
                  setUnidadeId("");
                }}
                className="input h-9"
              >
                <option value="">Ferramenta</option>
                {estado.ferramentas.map((ferramenta) => (
                  <option key={ferramenta.id} value={ferramenta.id}>
                    {ferramenta.nome}
                  </option>
                ))}
              </select>
              <select
                value={unidadeId}
                onChange={(event) => setUnidadeId(event.target.value)}
                disabled={!ferramentaId}
                className="input h-9"
              >
                <option value="">Unidade disponível</option>
                {unidadesDisponiveisDaFerramenta.map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.codigo}
                  </option>
                ))}
              </select>
              <select
                value={funcionarioId}
                onChange={(event) => setFuncionarioId(event.target.value)}
                className="input h-9"
              >
                <option value="">Técnico</option>
                {estado.funcionarios.map((funcionario) => (
                  <option key={funcionario.id} value={funcionario.id}>
                    {funcionario.nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={atribuir}
                disabled={salvando || !unidadeId || !funcionarioId}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
              >
                Atribuir
              </button>
            </div>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {cardsPorTecnico.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhuma ferramenta atribuída no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {cardsPorTecnico.map(({ funcionario, unidades }) => (
            <div key={funcionario.id} className="rounded-[8px] border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-ink-3" />
                  <h4 className="text-sm font-semibold text-ink">{funcionario.nome}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => verHistorico(funcionario)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-orange hover:text-orange-deep"
                >
                  <History className="h-3.5 w-3.5" />
                  Histórico
                </button>
              </div>
              {unidades.length === 0 ? (
                <p className="mt-3 text-xs text-ink-3">
                  Sem unidade atribuída no PCM (só divergência com o Auvo — ver histórico).
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {unidades.map((unidade) => {
                    const divergencia = divergenciaDe(funcionario.id, unidade.ferramentaId);
                    return (
                      <li
                        key={unidade.id}
                        className="flex items-center justify-between gap-2 rounded-[6px] border border-line-soft bg-paper px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-ink-2">
                            {unidade.ferramentaNome} ·{" "}
                            <span className="font-brand">{unidade.codigo}</span>
                          </p>
                          <p className="text-[10px] text-ink-3">
                            desde{" "}
                            {unidade.atribuidaEm
                              ? new Date(unidade.atribuidaEm).toLocaleDateString("pt-BR")
                              : "—"}
                            {divergencia?.divergente && (
                              <span className="ml-2 inline-flex items-center gap-1 text-[#A16B0B]">
                                <AlertTriangle className="h-3 w-3" />
                                Auvo diverge ({divergencia.diferenca > 0 ? "+" : ""}
                                {divergencia.diferenca})
                              </span>
                            )}
                          </p>
                        </div>
                        {temEscrita && (
                          <button
                            type="button"
                            onClick={() => setDevolucao(unidade)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-[6px] border border-line px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-line-soft"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Devolver
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {devolucao && (
        <DevolucaoModal
          unidade={devolucao}
          onCancel={() => setDevolucao(null)}
          onConfirmar={async (condicao, motivo) => {
            if (!user) return;
            await devolverUnidadeFerramenta(supabaseFerramentaUnidadesAdapter, {
              unidadeId: devolucao.id,
              condicao,
              motivo,
              userId: user.id,
            });
            setDevolucao(null);
            await carregar();
          }}
        />
      )}

      {historicoFuncionario && (
        <HistoricoModal
          titulo={`Histórico de ${historicoFuncionario.nome}`}
          itens={historicoFuncionario.itens}
          onFechar={() => setHistoricoFuncionario(null)}
        />
      )}
    </div>
  );
}

function DevolucaoModal({
  unidade,
  onCancel,
  onConfirmar,
}: {
  unidade: FerramentaUnidadeItem;
  onCancel: () => void;
  onConfirmar: (condicao: CondicaoDevolucao, motivo: string) => Promise<void>;
}) {
  const [condicao, setCondicao] = useState<CondicaoDevolucao>("ok");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    try {
      setSalvando(true);
      setErro(null);
      await onConfirmar(condicao, motivo);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível registrar a devolução.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-md rounded-[8px] border border-line bg-card shadow-xl">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Devolver {unidade.codigo}</h3>
          <p className="text-xs text-ink-3">{unidade.ferramentaNome}</p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Condição</span>
            <select
              value={condicao}
              onChange={(event) => setCondicao(event.target.value as CondicaoDevolucao)}
              className="input w-full"
            >
              <option value="ok">OK</option>
              <option value="danificada">Danificada</option>
              <option value="perdida">Perdida</option>
            </select>
          </label>
          {condicao !== "ok" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">
                O que aconteceu? *
              </span>
              <textarea
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                className="input min-h-[80px] w-full resize-y"
              />
            </label>
          )}
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Confirmar devolução"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoricoModal({
  titulo,
  itens,
  onFechar,
}: {
  titulo: string;
  itens: MovimentacaoFerramentaItem[];
  onFechar: () => void;
}) {
  const rotuloTipo: Record<MovimentacaoFerramentaItem["tipo"], string> = {
    atribuicao: "Atribuição",
    devolucao: "Devolução",
    baixa: "Baixa",
  };
  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">{titulo}</h3>
          <button type="button" onClick={onFechar} className="text-ink-3 hover:text-ink">
            fechar
          </button>
        </div>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
          {itens.length === 0 ? (
            <p className="text-sm text-ink-3">Sem movimentações registradas.</p>
          ) : (
            itens.map((item) => (
              <div
                key={item.id}
                className="rounded-[6px] border border-line-soft bg-paper p-2.5 text-sm"
              >
                <p className="font-semibold text-ink-2">
                  {rotuloTipo[item.tipo]} · {item.ferramentaNome} ({item.unidadeCodigo})
                </p>
                <p className="text-xs text-ink-3">
                  {new Date(item.dataMovimento).toLocaleString("pt-BR")}
                  {item.condicao && item.condicao !== "ok" ? ` · ${item.condicao}` : ""}
                </p>
                {item.motivo && <p className="mt-1 text-xs text-ink-2">{item.motivo}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
