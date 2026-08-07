import { AlertTriangle, History, RefreshCw, Undo2, UserRound, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  alocarFerramenta,
  devolverFerramenta,
  listarAlocacoesAtivas,
  listarClientesParaAlocacao,
  listarFerramentasDisponiveis,
} from "../application/ferramenta-alocacao-cliente";
import type {
  ClienteOpcaoFerramenta,
  FerramentaOpcao as FerramentaOpcaoAlocavel,
} from "../application/ferramenta-alocacao-cliente-gateway";
import {
  atribuirUnidadeFerramenta,
  devolverUnidadeFerramenta,
  listarHistoricoFuncionario,
  listarUnidadesFerramenta,
} from "../application/ferramenta-unidades";
import { obterFerramentasPorTecnico } from "../application/ferramentas";
import { HistoricoMovimentacoesModal } from "../components/HistoricoMovimentacoesModal";
import type { AlocacaoFerramentaCliente } from "../domain/ferramenta-alocacao-cliente";
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
import { supabaseFerramentaAlocacaoClienteAdapter } from "../infrastructure/supabase-ferramenta-alocacao-cliente-adapter";
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

// E01-S113: hub único de alocação de ferramentas — "Por Técnico" (unidade individual, E01-S65) e
// "Por Cliente" (ferramenta agregada, E01-S106) reunidos na mesma tela, cada um com seu próprio
// modelo/gateway (não são o mesmo conceito, só a UI foi unificada — ver spec.md "fora de escopo").
type AbaFerramentas = "tecnico" | "cliente";

export function FerramentasPorTecnicoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [aba, setAba] = useState<AbaFerramentas>("tecnico");
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
  const [tecnicoModal, setTecnicoModal] = useState<FuncionarioFerramentaOpcao | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

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
      // E01-S137 AC-1: o hub operacional sempre mostra todos os técnicos ativos, inclusive
      // quem ainda não recebeu unidade nem possui divergência Auvo.
      porTecnico.set(funcionario.id, { funcionario, unidades: unidadesDoFuncionario });
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

  async function atribuirSelecionadas() {
    if (!user || !tecnicoModal || selecionadas.length === 0) return;
    try {
      setSalvando(true);
      setErroAcao(null);
      for (const unidadeId of selecionadas) {
        await atribuirUnidadeFerramenta(supabaseFerramentaUnidadesAdapter, {
          unidadeId,
          funcionarioId: tecnicoModal.id,
          userId: user.id,
        });
      }
      setSelecionadas([]);
      await carregar();
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível atribuir as unidades.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
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
      <div className="flex gap-1 border-b border-line">
        {(
          [
            { id: "tecnico", label: "Por Técnico" },
            { id: "cliente", label: "Por Cliente" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAba(item.id)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              aba === item.id
                ? "border-orange text-navy"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {aba === "cliente" ? (
        <AbaPorCliente temEscrita={temEscrita} />
      ) : (
        <>
          <section className="rounded-lg border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Ferramentas por Técnico</h3>
                <p className="mt-0.5 text-sm text-ink-3">
                  Posse por unidade individual — histórico nunca é sobrescrito (PCM é dono; Auvo é
                  só sinal de conferência)
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
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
                  >
                    Atribuir
                  </button>
                </div>
              )}
            </div>
            {erroAcao && (
              <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
                {erroAcao}
              </div>
            )}
          </section>

          {cardsPorTecnico.length === 0 ? (
            <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
              <Wrench className="mx-auto h-9 w-9 text-ink-3" />
              <p className="mt-3 text-sm text-ink-3">Nenhuma ferramenta atribuída no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {cardsPorTecnico.map(({ funcionario, unidades }) => (
                <div key={funcionario.id} className="rounded-lg border border-line bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-ink-3" />
                      <h4 className="text-sm font-semibold text-ink">{funcionario.nome}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTecnicoModal(funcionario);
                        setSelecionadas([]);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-orange hover:text-orange-deep"
                    >
                      <History className="h-3.5 w-3.5" />
                      Ver técnico
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
                            className="flex items-center justify-between gap-2 rounded-md border border-line-soft bg-paper px-3 py-2 text-sm"
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
                                  <span className="ml-2 inline-flex items-center gap-1 text-warning">
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
                                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-line-soft"
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
            <HistoricoMovimentacoesModal
              titulo={`Histórico de ${historicoFuncionario.nome}`}
              itens={historicoFuncionario.itens}
              onFechar={() => setHistoricoFuncionario(null)}
            />
          )}
          {tecnicoModal && (
            <TecnicoFerramentasModal
              funcionario={tecnicoModal}
              unidades={estado.unidades}
              selecionadas={selecionadas}
              temEscrita={temEscrita}
              salvando={salvando}
              onSelecionar={(id) =>
                setSelecionadas((atual) =>
                  atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
                )
              }
              onFechar={() => setTecnicoModal(null)}
              onAtribuir={() => void atribuirSelecionadas()}
              onHistorico={() => void verHistorico(tecnicoModal)}
              onDevolver={(unidade) => setDevolucao(unidade)}
            />
          )}
        </>
      )}
    </div>
  );
}

function TecnicoFerramentasModal({
  funcionario,
  unidades,
  selecionadas,
  temEscrita,
  salvando,
  onSelecionar,
  onFechar,
  onAtribuir,
  onHistorico,
  onDevolver,
}: {
  funcionario: FuncionarioFerramentaOpcao;
  unidades: FerramentaUnidadeItem[];
  selecionadas: string[];
  temEscrita: boolean;
  salvando: boolean;
  onSelecionar: (id: string) => void;
  onFechar: () => void;
  onAtribuir: () => void;
  onHistorico: () => void;
  onDevolver: (unidade: FerramentaUnidadeItem) => void;
}) {
  const disponiveis = unidades.filter((unidade) => unidade.status === "disponivel");
  const posse = unidades.filter((unidade) => unidade.atribuidaA === funcionario.id);
  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-4xl rounded-lg border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-ink">{funcionario.nome}</h3>
            <p className="text-xs text-ink-3">Ferramentas, transferência e histórico</p>
          </div>
          <button type="button" onClick={onFechar} className="btn-secondary">
            Fechar
          </button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <section>
            <h4 className="text-sm font-semibold text-ink">Disponíveis</h4>
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {disponiveis.map((unidade) => (
                <label
                  key={unidade.id}
                  className="flex items-center gap-2 rounded border border-line-soft p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selecionadas.includes(unidade.id)}
                    disabled={!temEscrita}
                    onChange={() => onSelecionar(unidade.id)}
                  />
                  {unidade.ferramentaNome} · {unidade.codigo}
                </label>
              ))}
            </div>
          </section>
          <section>
            <h4 className="text-sm font-semibold text-ink">Em posse</h4>
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {posse.length === 0 ? (
                <p className="text-sm text-ink-3">Sem unidade atribuída.</p>
              ) : (
                posse.map((unidade) => (
                  <div
                    key={unidade.id}
                    className="flex justify-between rounded border border-line-soft p-2 text-sm"
                  >
                    <span>
                      {unidade.ferramentaNome} · {unidade.codigo}
                    </span>
                    {temEscrita && (
                      <button
                        type="button"
                        onClick={() => onDevolver(unidade)}
                        className="text-orange"
                      >
                        Devolver
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
        <div className="flex justify-between border-t border-line px-4 py-3">
          <button type="button" onClick={onHistorico} className="btn-secondary">
            Histórico
          </button>
          {temEscrita && (
            <button
              type="button"
              disabled={salvando || selecionadas.length === 0}
              onClick={onAtribuir}
              className="btn-primary"
            >
              Atribuir {selecionadas.length || ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** E01-S113: aba "Por Cliente" — reusa o gateway/adapter de E01-S106 sem duplicar CRUD (AC-3);
 * visão operacional centralizada (todas as alocações ativas, qualquer cliente), distinta do painel
 * já existente na Visão 360 (escopo de 1 cliente só, que continua existindo à parte). */
function AbaPorCliente({ temEscrita }: { temEscrita: boolean }) {
  const { user } = useAuth();
  const [alocacoes, setAlocacoes] = useState<AlocacaoFerramentaCliente[]>([]);
  const [ferramentasDisponiveis, setFerramentasDisponiveis] = useState<FerramentaOpcaoAlocavel[]>(
    [],
  );
  const [clientes, setClientes] = useState<ClienteOpcaoFerramenta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ferramentaId, setFerramentaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [ativas, ferramentas, opcoesClientes] = await Promise.all([
        listarAlocacoesAtivas(supabaseFerramentaAlocacaoClienteAdapter),
        listarFerramentasDisponiveis(supabaseFerramentaAlocacaoClienteAdapter),
        listarClientesParaAlocacao(supabaseFerramentaAlocacaoClienteAdapter),
      ]);
      setAlocacoes(ativas);
      setFerramentasDisponiveis(ferramentas);
      setClientes(opcoesClientes);
      setFerramentaId((atual) => (ferramentas.some((f) => f.id === atual) ? atual : ""));
      setClienteId((atual) => (opcoesClientes.some((c) => c.id === atual) ? atual : ""));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alocar() {
    if (!user || !ferramentaId || !clienteId) return;
    setSalvando(true);
    setErro(null);
    try {
      await alocarFerramenta(
        supabaseFerramentaAlocacaoClienteAdapter,
        ferramentaId,
        clienteId,
        user.id,
      );
      setFerramentaId("");
      setClienteId("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alocar a ferramenta.");
    } finally {
      setSalvando(false);
    }
  }

  async function devolver(alocacaoId: string) {
    if (!user) return;
    await devolverFerramenta(supabaseFerramentaAlocacaoClienteAdapter, alocacaoId, user.id);
    await carregar();
  }

  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">Ferramentas por Cliente</h3>
          <p className="mt-0.5 text-sm text-ink-3">
            Ferramentas da Sinérgica emprestadas/em uso em clientes (mesma alocação da Visão 360)
          </p>
        </div>
        {temEscrita && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]">
            <select
              value={ferramentaId}
              onChange={(event) => setFerramentaId(event.target.value)}
              className="input h-9"
            >
              <option value="">Ferramenta disponível</option>
              {ferramentasDisponiveis.map((ferramenta) => (
                <option key={ferramenta.id} value={ferramenta.id}>
                  {ferramenta.nome}
                </option>
              ))}
            </select>
            <select
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              className="input h-9"
            >
              <option value="">Cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={alocar}
              disabled={salvando || !ferramentaId || !clienteId}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
            >
              Alocar
            </button>
          </div>
        )}
      </div>
      {erro && (
        <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </div>
      )}
      {carregando ? (
        <p className="mt-4 text-center text-sm text-ink-3">Carregando…</p>
      ) : alocacoes.length === 0 ? (
        <div className="mt-4 rounded-lg border border-line-soft bg-paper px-5 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">
            Nenhuma ferramenta alocada a cliente no momento.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line-soft">
          {alocacoes.map((alocacao) => (
            <li key={alocacao.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{alocacao.ferramentaNome}</p>
                <p className="mt-0.5 truncate text-xs text-ink-3">
                  {alocacao.clienteNome} · desde{" "}
                  {new Date(alocacao.alocadaEm).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => devolver(alocacao.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-line-soft"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Devolver
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
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
      <div className="w-full max-w-md rounded-lg border border-line bg-card shadow-xl">
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
            <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando}
            className="h-9 rounded-md bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Confirmar devolução"}
          </button>
        </div>
      </div>
    </div>
  );
}
