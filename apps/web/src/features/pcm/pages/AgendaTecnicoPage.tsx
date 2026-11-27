// AgendaTecnicoPage.tsx — E01-S104. Board semanal de agenda do técnico: colunas por dia (seg-sáb),
// card por alocação técnico+cliente. 1ª fase só visual/manual — sem alocação automática nem
// checagem de conflito (spec.md "Fora de escopo").
//
// E01-S202 — a tela ganhou uma SEGUNDA fonte, atrás da flag
// `VITE_SSO_AGENDA_PROJECAO_VISITA_ENABLED`, desligada por padrão:
//   • flag DESLIGADA → exatamente o comportamento de antes (cadastro manual `pcm.agenda_tecnico`);
//   • flag LIGADA    → a agenda vira PROJEÇÃO da Visita (`sso_listar_agenda_tecnico_projetada`),
//     sem cadastro paralelo, como decidiu o Pacote Consolidado de 13/11/2026.
// O cadastro manual está aposentado no banco (trigger `sso_agenda_tecnico_obsoleta`, migration
// 1867): o histórico continua legível, escrita nova é recusada com erro nomeado — traduzido para
// uma frase em português no formulário, nunca um erro cru do Postgres.
import { Button, DataTable, type DataTableColumn, Modal, Skeleton } from "@sinergica/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { flagLigada } from "../../../config/flags-sso";
import { agendaProjecaoQueryKeys } from "../application/agenda-projecao-queries";
import {
  criarAlocacao,
  editarAlocacao,
  listarOpcoesAgenda,
  listarSemanaAgenda,
  removerAlocacao,
} from "../application/agenda-tecnico";
import type { OpcaoClienteAgenda, OpcaoFuncionario } from "../application/agenda-tecnico-gateway";
import {
  type AlocacaoProjetada,
  FRASE_PROJECAO_INDISPONIVEL,
  FRASE_SEMANA_SEM_VISITA,
  type LinhaTecnicoProjetada,
  ROTULO_PERIODO,
  agruparProjecaoPorDia,
  agruparProjecaoPorTecnico,
  inicioSemanaIso,
  mensagemDeErroDeAlocacaoManual,
  motivoDoErroProjecao,
} from "../domain/agenda-projecao-visita";
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
import { listarAgendaProjetada } from "../infrastructure/supabase-agenda-projecao-adapter";
import { supabaseAgendaTecnicoAdapter } from "../infrastructure/supabase-agenda-tecnico-adapter";

const DIA_LABEL = ["SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];

export function AgendaTecnicoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");
  // E01-S202 AC-F2: flag nasce desligada; com ela desligada nada abaixo muda.
  const projecaoLigada = flagLigada("VITE_SSO_AGENDA_PROJECAO_VISITA_ENABLED");

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
    // Com a projeção ligada não se lê mais o cadastro manual — ele é histórico.
    if (!permissoesCarregando && temLeitura && !projecaoLigada) carregar();
  }, [permissoesCarregando, temLeitura, projecaoLigada, carregar]);

  // E01-S202: dado de servidor por TanStack Query. `retry: false` porque gate fechado e falta de
  // capacidade são erros PERMANENTES — repetir só atrasaria a frase certa.
  const semanaInicio = inicioSemanaIso(referencia);
  const projecao = useQuery({
    queryKey: agendaProjecaoQueryKeys.semana(semanaInicio, null),
    queryFn: ({ signal }) => listarAgendaProjetada(semanaInicio, null, signal),
    // E00-S29 — navegar entre semanas troca a chave. Sem isto o calendário esvaziava a cada
    // clique na seta antes de encher de novo. `keepPreviousData` mantém a semana anterior na
    // tela até a nova chegar; o `signal` acima garante que uma resposta atrasada nunca
    // sobrescreva a semana que o usuário já escolheu depois.
    placeholderData: keepPreviousData,
    enabled: projecaoLigada && !permissoesCarregando && temLeitura,
    retry: false,
  });

  async function remover(id: string) {
    try {
      await removerAlocacao(supabaseAgendaTecnicoAdapter, id);
    } catch (e) {
      setErro(mensagemDeErroDeAlocacaoManual(e));
      return;
    }
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

  // E01-S202 AC-6: "desligado", "sem permissão", "erro" e "semana sem Visita" são QUATRO estados
  // diferentes e cada um tem a sua frase. `return null` silencioso é recusado no review.
  const avisoProjecao: string | null = !projecaoLigada
    ? null
    : projecao.isError
      ? FRASE_PROJECAO_INDISPONIVEL[motivoDoErroProjecao(projecao.error)]
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold text-ink">Agenda do Técnico</h1>
          <p className="text-body text-ink-3">
            {projecaoLigada
              ? "Projeção das Visitas da semana — não é cadastro: a alocação nasce da Visita"
              : "Cronograma semanal — em que cliente cada técnico estará cada dia"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => setReferencia(semanaAnterior(referencia))}
            className="btn-secondary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setReferencia(new Date())} className="btn-secondary">
            Hoje
          </button>
          <button
            type="button"
            aria-label="Próxima semana"
            onClick={() => setReferencia(semanaSeguinte(referencia))}
            className="btn-secondary"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
          {erro}
        </div>
      )}

      {avisoProjecao && (
        <div
          role="alert"
          className="rounded-md border border-warning-line bg-warning-soft px-4 py-2 text-body text-warning"
        >
          {avisoProjecao}
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

      {projecaoLigada ? (
        projecao.isPending ? (
          <div className="flex flex-col gap-3 p-8">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        ) : projecao.isError ? // a frase do erro já está no alerta acima — nunca vazio mudo
        null : (
          <ProjecaoDaVisita
            alocacoes={projecao.data ?? []}
            dias={dias}
            diaLabel={DIA_LABEL}
            visao={visao}
          />
        )
      ) : carregando ? (
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

// E01-S202 — a mesma tela, alimentada pela Visita. Sem botão de criar: "uma entidade tem uma tela
// principal e pode ter várias projeções; não deve possuir vários cadastros independentes".
function ProjecaoDaVisita({
  alocacoes,
  dias,
  diaLabel,
  visao,
}: {
  alocacoes: AlocacaoProjetada[];
  dias: string[];
  diaLabel: string[];
  visao: "dia" | "tecnico";
}) {
  if (alocacoes.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-card p-8 text-center text-body text-ink-3">
        {FRASE_SEMANA_SEM_VISITA}
      </div>
    );
  }

  if (visao === "tecnico") {
    const linhas: LinhaTecnicoProjetada[] = agruparProjecaoPorTecnico(alocacoes, dias);
    const colunas: DataTableColumn<LinhaTecnicoProjetada>[] = [
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
        render: (linha: LinhaTecnicoProjetada) => {
          const doDia = linha.porDia.get(dia) ?? [];
          return doDia.length === 0 ? (
            <span className="px-2 text-caption text-ink-4">—</span>
          ) : (
            <div className="flex flex-col gap-1">
              {doDia.map((alocacao) => (
                <CartaoVisita
                  key={`${alocacao.visitaId}-${alocacao.funcionarioId}`}
                  {...alocacao}
                />
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
          vazio={FRASE_SEMANA_SEM_VISITA}
        />
      </div>
    );
  }

  const porDia = agruparProjecaoPorDia(alocacoes, dias);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {dias.map((dia, index) => (
        <div key={dia} className="flex flex-col rounded-lg border border-line bg-card">
          <div className="border-b border-line-soft px-3 py-2">
            <p className="text-micro font-semibold tracking-wide text-ink-3">{diaLabel[index]}</p>
            <p className="text-body font-semibold text-ink">
              {new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-2">
            {(porDia.get(dia) ?? []).length === 0 ? (
              <p className="px-2 py-3 text-center text-caption text-ink-3">Sem Visita</p>
            ) : (
              (porDia.get(dia) ?? []).map((alocacao) => (
                <CartaoVisita
                  key={`${alocacao.visitaId}-${alocacao.funcionarioId}`}
                  {...alocacao}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cartão da alocação projetada: técnico, cliente, horário ou período e as OS vinculadas da Visita — a união
 * de Agenda e OS acontece na origem, não numa deduplicação posterior. */
function CartaoVisita(alocacao: AlocacaoProjetada) {
  return (
    <div className="rounded-md border border-line-soft px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: corDoTecnico(alocacao.funcionarioId) }}
        />
        <p className="truncate text-caption font-semibold text-ink">{alocacao.funcionarioNome}</p>
      </div>
      <p className="mt-0.5 pl-3.5 text-caption text-ink-3">
        {alocacao.horariosAuvo.join(", ") || ROTULO_PERIODO[alocacao.periodo]}
      </p>
      <p className="mt-0.5 truncate pl-3.5 text-caption text-ink-3">{alocacao.clienteNome}</p>
      <p className="truncate pl-3.5 text-micro text-ink-4">
        {alocacao.papel} · Visita {alocacao.estado}
      </p>
      <p className="pl-3.5 text-micro text-ink-3">
        {alocacao.quantidadeOs === 0
          ? "Nenhuma OS vinculada a esta Visita"
          : `${alocacao.quantidadeOs} OS: ${alocacao.osNumeros.join(", ")}`}
      </p>
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
      setErro(mensagemDeErroDeAlocacaoManual(e));
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
