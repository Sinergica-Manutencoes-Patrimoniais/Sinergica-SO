// AgendaTecnicoPage.tsx — E01-S104. Board semanal de agenda do técnico: colunas por dia (seg-sáb),
// card por alocação técnico+cliente. 1ª fase só visual/manual — sem alocação automática nem
// checagem de conflito (spec.md "Fora de escopo").
import { Button, DataTable, type DataTableColumn, Modal, Skeleton } from "@sinergica/ui";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarAlocacao,
  editarAlocacao,
  listarOpcoesAgenda,
  listarSemanaAgenda,
  removerAlocacao,
} from "../application/agenda-tecnico";
import type { OpcaoClienteAgenda, OpcaoFuncionario } from "../application/agenda-tecnico-gateway";
import {
  type AlocacaoTecnico,
  type LinhaTecnicoAgenda,
  agruparAlocacoesPorTecnico,
  agruparPorDia,
  corDoTecnico,
  diasDaSemana,
  semanaAnterior,
  semanaSeguinte,
} from "../domain/agenda-tecnico";
import { supabaseAgendaTecnicoAdapter } from "../infrastructure/supabase-agenda-tecnico-adapter";

const DIA_LABEL = ["SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];

export function AgendaTecnicoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const [referencia, setReferencia] = useState(() => new Date());
  const [alocacoes, setAlocacoes] = useState<AlocacaoTecnico[]>([]);
  const [funcionarios, setFuncionarios] = useState<OpcaoFuncionario[]>([]);
  const [clientes, setClientes] = useState<OpcaoClienteAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState<{ dia: string; alocacao: AlocacaoTecnico | null } | null>(
    null,
  );
  // E01-S140 AC-1: "Por dia" é o default — comportamento atual preservado.
  const [visao, setVisao] = useState<"dia" | "tecnico">("dia");

  const dias = diasDaSemana(referencia);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      // `diasDaSemana` sempre devolve 6 elementos (seg-sáb) — non-null assertion segura.
      const [semanaAlocacoes, [opcoesFuncionarios, opcoesClientes]] = await Promise.all([
        listarSemanaAgenda(supabaseAgendaTecnicoAdapter, dias[0] as string, dias.at(-1) as string),
        listarOpcoesAgenda(supabaseAgendaTecnicoAdapter),
      ]);
      setAlocacoes(semanaAlocacoes);
      setFuncionarios(opcoesFuncionarios);
      setClientes(opcoesClientes);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a agenda.");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias[0], dias[dias.length - 1]]);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function remover(id: string) {
    await removerAlocacao(supabaseAgendaTecnicoAdapter, id);
    await carregar();
  }

  if (permissoesCarregando) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-body text-ink-3">
          Você não tem permissão de leitura no módulo PCM.
        </p>
      </div>
    );
  }

  const porDia = agruparPorDia(alocacoes, dias);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold text-ink">Agenda do Técnico</h1>
          <p className="text-body text-ink-3">
            Cronograma semanal — em que cliente cada técnico estará cada dia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReferencia(semanaAnterior(referencia))}
            className="btn-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setReferencia(new Date())} className="btn-secondary">
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setReferencia(semanaSeguinte(referencia))}
            className="btn-secondary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
          {erro}
        </div>
      )}

      <div className="inline-flex w-fit rounded-md border border-line bg-card p-0.5">
        <button
          type="button"
          onClick={() => setVisao("dia")}
          className={`rounded px-3 py-1.5 text-caption font-semibold transition-colors ${
            visao === "dia" ? "bg-navy text-white" : "text-ink-3 hover:text-ink"
          }`}
        >
          Por dia
        </button>
        <button
          type="button"
          onClick={() => setVisao("tecnico")}
          className={`rounded px-3 py-1.5 text-caption font-semibold transition-colors ${
            visao === "tecnico" ? "bg-navy text-white" : "text-ink-3 hover:text-ink"
          }`}
        >
          Por técnico
        </button>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-3 p-8">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      ) : visao === "tecnico" ? (
        <TimelinePorTecnico
          alocacoes={alocacoes}
          dias={dias}
          diaLabel={DIA_LABEL}
          temEscrita={temEscrita}
          onAbrirModal={(dia, alocacao) => setModal({ dia, alocacao })}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {dias.map((dia, index) => (
            <div key={dia} className="flex flex-col rounded-lg border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
                <div>
                  <p className="text-micro font-semibold tracking-wide text-ink-3">
                    {DIA_LABEL[index]}
                  </p>
                  <p className="text-body font-semibold text-ink">
                    {new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </p>
                </div>
                {temEscrita && (
                  <button
                    type="button"
                    onClick={() => setModal({ dia, alocacao: null })}
                    className="rounded-md p-1 text-ink-3 hover:bg-line-soft hover:text-ink"
                    aria-label={`Adicionar alocação em ${dia}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {(porDia.get(dia) ?? []).length === 0 ? (
                  <p className="px-2 py-3 text-center text-caption text-ink-3">Sem alocação</p>
                ) : (
                  (porDia.get(dia) ?? []).map((alocacao) => (
                    <button
                      key={alocacao.id}
                      type="button"
                      onClick={() => temEscrita && setModal({ dia, alocacao })}
                      className="rounded-md border border-line-soft px-2.5 py-2 text-left hover:bg-line-soft"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: corDoTecnico(alocacao.funcionarioId) }}
                        />
                        <p className="truncate text-caption font-semibold text-ink">
                          {alocacao.funcionarioNome}
                          {alocacao.horaInicio && (
                            <span className="ml-1 font-normal text-ink-3">
                              {alocacao.horaFim
                                ? `${alocacao.horaInicio}–${alocacao.horaFim}`
                                : alocacao.horaInicio}
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate pl-3.5 text-caption text-ink-3">
                        {alocacao.clienteNome}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && user && (
        <AlocacaoModal
          dia={modal.dia}
          alocacao={modal.alocacao}
          funcionarios={funcionarios}
          clientes={clientes}
          onCancel={() => setModal(null)}
          onRemover={modal.alocacao ? () => remover(modal.alocacao?.id ?? "") : undefined}
          onSalvar={async (dados) => {
            if (modal.alocacao) {
              await editarAlocacao(supabaseAgendaTecnicoAdapter, modal.alocacao.id, dados, user.id);
            } else {
              await criarAlocacao(supabaseAgendaTecnicoAdapter, dados, user.id);
            }
            setModal(null);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

// E01-S140: visão timeline — linha por técnico, coluna por dia. Mesmos dados e ações da visão por
// dia (AC-5/AC-6), só muda o agrupamento visual.
function TimelinePorTecnico({
  alocacoes,
  dias,
  diaLabel,
  temEscrita,
  onAbrirModal,
}: {
  alocacoes: AlocacaoTecnico[];
  dias: string[];
  diaLabel: string[];
  temEscrita: boolean;
  onAbrirModal: (dia: string, alocacao: AlocacaoTecnico | null) => void;
}) {
  const linhas = agruparAlocacoesPorTecnico(alocacoes, dias);

  if (linhas.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-card p-8 text-center text-body text-ink-3">
        Nenhuma alocação nesta semana.
      </div>
    );
  }

  const colunas: DataTableColumn<LinhaTecnicoAgenda>[] = [
    {
      chave: "tecnico",
      cabecalho: "Técnico",
      larguraMin: "160px",
      render: (linha) => (
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: corDoTecnico(linha.funcionarioId) }}
          />
          <span className="truncate text-caption font-semibold text-ink">
            {linha.funcionarioNome}
          </span>
        </div>
      ),
    },
    ...dias.map((dia, index) => ({
      chave: dia,
      cabecalho: (
        <>
          {diaLabel[index]}{" "}
          {new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </>
      ),
      render: (linha: LinhaTecnicoAgenda) => {
        const doDia = linha.porDia.get(dia) ?? [];
        return doDia.length === 0 ? (
          <button
            type="button"
            onClick={() => temEscrita && onAbrirModal(dia, null)}
            className="w-full rounded-md px-2 py-1.5 text-left text-caption text-ink-4 hover:bg-line-soft"
          >
            —
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            {doDia.map((alocacao) => (
              <button
                key={alocacao.id}
                type="button"
                onClick={() => temEscrita && onAbrirModal(dia, alocacao)}
                className="rounded-md border border-line-soft px-2 py-1.5 text-left hover:bg-line-soft"
              >
                <p className="truncate text-caption text-ink">
                  {alocacao.clienteNome}
                  {alocacao.horaInicio && (
                    <span className="ml-1 text-ink-3">
                      {alocacao.horaFim
                        ? `${alocacao.horaInicio}–${alocacao.horaFim}`
                        : alocacao.horaInicio}
                    </span>
                  )}
                </p>
              </button>
            ))}
          </div>
        );
      },
    })),
  ];

  return (
    <div className="rounded-lg border border-line bg-card">
      <DataTable
        colunas={colunas}
        itens={linhas}
        chaveLinha={(linha) => linha.funcionarioId}
        vazio={<>Nenhuma alocação nesta semana.</>}
      />
    </div>
  );
}

function AlocacaoModal({
  dia,
  alocacao,
  funcionarios,
  clientes,
  onCancel,
  onSalvar,
  onRemover,
}: {
  dia: string;
  alocacao: AlocacaoTecnico | null;
  funcionarios: OpcaoFuncionario[];
  clientes: OpcaoClienteAgenda[];
  onCancel: () => void;
  onSalvar: (dados: {
    funcionarioId: string;
    clienteId: string;
    data: string;
    horaInicio: string | null;
    horaFim: string | null;
  }) => Promise<void>;
  onRemover?: () => Promise<void>;
}) {
  const [funcionarioId, setFuncionarioId] = useState(
    alocacao?.funcionarioId ?? funcionarios[0]?.id ?? "",
  );
  const [clienteId, setClienteId] = useState(alocacao?.clienteId ?? clientes[0]?.id ?? "");
  const [horaInicio, setHoraInicio] = useState(alocacao?.horaInicio ?? "");
  const [horaFim, setHoraFim] = useState(alocacao?.horaFim ?? "");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      // AC-2: valida no cliente antes do round-trip — mesma regra de `validarAlocacao`, aqui só
      // pra dar feedback imediato sem depender do erro do domínio vir de dentro de `onSalvar`.
      if (horaFim && !horaInicio) {
        throw new Error("Informe o horário de início junto com o de fim.");
      }
      if (horaInicio && horaFim && horaFim < horaInicio) {
        throw new Error("O horário de fim não pode ser antes do início.");
      }
      await onSalvar({
        funcionarioId,
        clienteId,
        data: dia,
        horaInicio: horaInicio || null,
        horaFim: horaFim || null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a alocação.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!onRemover) return;
    setRemovendo(true);
    try {
      await onRemover();
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={
        <>
          {alocacao ? "Editar alocação" : "Nova alocação"} ·{" "}
          {new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR")}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Técnico *</span>
          <select
            value={funcionarioId}
            onChange={(e) => setFuncionarioId(e.target.value)}
            className="input w-full"
          >
            {funcionarios.length === 0 ? (
              <option value="">Nenhum técnico disponível</option>
            ) : (
              funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Cliente *</span>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="input w-full"
          >
            {clientes.length === 0 ? (
              <option value="">Nenhum cliente disponível</option>
            ) : (
              clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Início</span>
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Fim</span>
            <input
              type="time"
              value={horaFim}
              onChange={(e) => setHoraFim(e.target.value)}
              className="input w-full"
            />
          </label>
        </div>
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
      </div>
      <div className="flex justify-between gap-2 border-t border-line px-4 py-3">
        {onRemover ? (
          <button
            type="button"
            onClick={remover}
            disabled={removendo}
            className="h-9 rounded-md border border-danger-line px-3 text-body font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
          >
            {removendo ? "Removendo…" : "Remover"}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !funcionarioId || !clienteId}
            className="h-9 rounded-md bg-navy px-3 text-body font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
