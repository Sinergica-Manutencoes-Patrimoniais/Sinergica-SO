// AgendaTecnicoPage.tsx — E01-S104. Board semanal de agenda do técnico: colunas por dia (seg-sáb),
// card por alocação técnico+cliente. 1ª fase só visual/manual — sem alocação automática nem
// checagem de conflito (spec.md "Fora de escopo").
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
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
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }

  const porDia = agruparPorDia(alocacoes, dias);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Agenda do Técnico</h2>
          <p className="text-sm text-ink-3">
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
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {dias.map((dia, index) => (
            <div key={dia} className="flex flex-col rounded-[8px] border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-ink-3">
                    {DIA_LABEL[index]}
                  </p>
                  <p className="text-sm font-semibold text-ink">
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
                    className="rounded-[6px] p-1 text-ink-3 hover:bg-line-soft hover:text-ink"
                    aria-label={`Adicionar alocação em ${dia}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {(porDia.get(dia) ?? []).length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-ink-3">Sem alocação</p>
                ) : (
                  (porDia.get(dia) ?? []).map((alocacao) => (
                    <button
                      key={alocacao.id}
                      type="button"
                      onClick={() => temEscrita && setModal({ dia, alocacao })}
                      className="rounded-[6px] border border-line-soft px-2.5 py-2 text-left hover:bg-line-soft"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: corDoTecnico(alocacao.funcionarioId) }}
                        />
                        <p className="truncate text-xs font-semibold text-ink">
                          {alocacao.funcionarioNome}
                          {alocacao.hora && (
                            <span className="ml-1 font-normal text-ink-3">{alocacao.hora}</span>
                          )}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate pl-3.5 text-xs text-ink-3">
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
    hora: string | null;
  }) => Promise<void>;
  onRemover?: () => Promise<void>;
}) {
  const [funcionarioId, setFuncionarioId] = useState(
    alocacao?.funcionarioId ?? funcionarios[0]?.id ?? "",
  );
  const [clienteId, setClienteId] = useState(alocacao?.clienteId ?? clientes[0]?.id ?? "");
  const [hora, setHora] = useState(alocacao?.hora ?? "");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ funcionarioId, clienteId, data: dia, hora: hora || null });
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
    <div className="modal-backdrop">
      <div className="w-full max-w-md rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {alocacao ? "Editar alocação" : "Nova alocação"} ·{" "}
            {new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR")}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Técnico *</span>
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
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente *</span>
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
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Hora</span>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="input w-full"
            />
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
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
              className="h-9 rounded-[6px] border border-[#F2C0B5] px-3 text-sm font-semibold text-[#A23B25] hover:bg-[#FFF4F1] disabled:opacity-50"
            >
              {removendo ? "Removendo…" : "Remover"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !funcionarioId || !clienteId}
              className="h-9 rounded-[6px] bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
