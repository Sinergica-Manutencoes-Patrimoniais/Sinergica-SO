// ChamadosPage.tsx — E01-S88. Chamado (CH-XXXX) — registro rastreável de tudo que ainda não é OS.
// AC-2: tela de criação interna. AC-3: gerar OS / enviar ao backlog. AC-4: cancelar com
// justificativa + anexo obrigatórios (justificativa; anexo é opcional).
import { ChevronDown, ChevronUp, Headset, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { carregarDadosAberturaOs } from "../application/abrir-ordem-servico";
import {
  cancelarChamado,
  criarChamado,
  gerarOsDoChamado,
  listarChamados,
} from "../application/chamados";
import type { DadosAberturaOs } from "../application/ordem-servico-gateway";
import { HistoricoAtendimentoChamado } from "../components/HistoricoAtendimentoChamado";
import {
  type Chamado,
  type ChamadoFormData,
  ORIGEM_CHAMADO_LABEL,
  STATUS_CHAMADO_LABEL,
  type StatusChamado,
} from "../domain/chamados";
import { supabaseChamadosAdapter } from "../infrastructure/supabase-chamados-adapter";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; chamados: Chamado[] };

type Modal =
  | { modo: "novo" }
  | { modo: "gerar-os"; chamado: Chamado; destino: "convertido_os" | "backlog" }
  | { modo: "cancelar"; chamado: Chamado }
  | null;

const STATUS_COR: Record<StatusChamado, string> = {
  aberto: "bg-[#EFF1F4] text-[#5A6175]",
  convertido_os: "bg-[#EAEEF8] text-[#2E3C70]",
  backlog: "bg-[#FDF1DF] text-[#9A5A00]",
  cancelado: "bg-[#FBEAEA] text-[#C5362B]",
};

export function ChamadosPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [dadosOs, setDadosOs] = useState<DadosAberturaOs | null>(null);
  const [historicoAbertoId, setHistoricoAbertoId] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      setEstado({ fase: "pronto", chamados: await listarChamados(supabaseChamadosAdapter) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar Chamados.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function abrirModalNovo() {
    setModal({ modo: "novo" });
    if (!dadosOs) setDadosOs(await carregarDadosAberturaOs(supabaseOrdemServicoAdapter));
  }

  async function abrirModalGerarOs(chamado: Chamado, destino: "convertido_os" | "backlog") {
    setModal({ modo: "gerar-os", chamado, destino });
    if (!dadosOs) setDadosOs(await carregarDadosAberturaOs(supabaseOrdemServicoAdapter));
  }

  async function salvarNovo(dados: ChamadoFormData) {
    if (!user) return;
    setErroAcao(null);
    await criarChamado(supabaseChamadosAdapter, { ...dados, userId: user.id });
    setModal(null);
    await carregar();
  }

  async function confirmarGerarOs(
    chamado: Chamado,
    destino: "convertido_os" | "backlog",
    campos: { tipoTarefaId: string; tecnicoId: string | null; dataPrevista: string | null },
  ) {
    if (!user) return;
    setErroAcao(null);
    await gerarOsDoChamado(
      supabaseChamadosAdapter,
      supabaseOrdemServicoAdapter,
      chamado,
      {
        categoria: "corretiva",
        prioridade: "media",
        gravidade: 3,
        urgencia: 3,
        tendencia: 3,
        dorCliente: null,
        observacao: null,
        localDescricao: null,
        solicitante: chamado.solicitante,
        origem: "manual",
        tecnicoId: campos.tecnicoId,
        tipoTarefaId: campos.tipoTarefaId,
        dataPrevista: campos.dataPrevista,
      },
      user.id,
      destino,
    );
    setModal(null);
    await carregar();
  }

  async function confirmarCancelar(chamado: Chamado, justificativa: string, anexo: File | null) {
    if (!user) return;
    setErroAcao(null);
    await cancelarChamado(supabaseChamadosAdapter, chamado, justificativa, anexo, user.id);
    setModal(null);
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
  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          <RefreshCw className="mr-1 inline h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Chamados</h2>
          <p className="text-sm text-ink-3">
            Registro rastreável do que ainda não é OS — solicitações, itens de inspeção
          </p>
        </div>
        <div className="flex items-center gap-2">
          {temEscrita && (
            <button
              type="button"
              onClick={abrirModalNovo}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-deep"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Chamado
            </button>
          )}
          <button type="button" onClick={carregar} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      {estado.chamados.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Headset className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum Chamado cadastrado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {estado.chamados.map((chamado) => (
            <section
              key={chamado.id}
              className="flex flex-col rounded-[8px] border border-line bg-card"
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-brand text-xs tabular-nums text-ink-3">{chamado.numero}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{chamado.titulo}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COR[chamado.status]}`}
                    >
                      {STATUS_CHAMADO_LABEL[chamado.status]}
                    </span>
                    <span className="shrink-0 rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                      {ORIGEM_CHAMADO_LABEL[chamado.origem]}
                    </span>
                  </div>
                  {chamado.descricao && (
                    <p className="mt-0.5 truncate text-xs text-ink-3">{chamado.descricao}</p>
                  )}
                </div>
                {temEscrita && chamado.status === "aberto" && (
                  <>
                    <button
                      type="button"
                      onClick={() => abrirModalGerarOs(chamado, "convertido_os")}
                      className="inline-flex h-8 shrink-0 items-center rounded-[6px] bg-navy px-2.5 text-xs font-semibold text-white hover:bg-navy-deep"
                    >
                      Gerar OS
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalGerarOs(chamado, "backlog")}
                      className="inline-flex h-8 shrink-0 items-center rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
                    >
                      Enviar ao backlog
                    </button>
                  </>
                )}
                {temEscrita && (chamado.status === "aberto" || chamado.status === "backlog") && (
                  <button
                    type="button"
                    onClick={() => setModal({ modo: "cancelar", chamado })}
                    className="inline-flex h-8 shrink-0 items-center rounded-[6px] border border-[#F2C0B5] px-2.5 text-xs font-semibold text-[#A23B25] hover:bg-[#FFF4F1]"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setHistoricoAbertoId(historicoAbertoId === chamado.id ? null : chamado.id)
                  }
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
                >
                  {historicoAbertoId === chamado.id ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  Histórico de atendimento
                </button>
              </div>
              {historicoAbertoId === chamado.id && (
                <div className="border-t border-line-soft px-4 py-3">
                  <HistoricoAtendimentoChamado
                    gateway={supabaseChamadosAdapter}
                    chamadoId={chamado.id}
                  />
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {modal?.modo === "novo" && dadosOs && (
        <NovoChamadoModal
          clientes={dadosOs.clientes}
          onCancel={() => setModal(null)}
          onSalvar={salvarNovo}
        />
      )}

      {modal?.modo === "gerar-os" && dadosOs && (
        <GerarOsModal
          chamado={modal.chamado}
          destino={modal.destino}
          dadosOs={dadosOs}
          onCancel={() => setModal(null)}
          onConfirmar={(campos) => confirmarGerarOs(modal.chamado, modal.destino, campos)}
        />
      )}

      {modal?.modo === "cancelar" && (
        <CancelarChamadoModal
          chamado={modal.chamado}
          onCancel={() => setModal(null)}
          onConfirmar={(justificativa, anexo) =>
            confirmarCancelar(modal.chamado, justificativa, anexo)
          }
        />
      )}
    </div>
  );
}

function NovoChamadoModal({
  clientes,
  onCancel,
  onSalvar,
}: {
  clientes: DadosAberturaOs["clientes"];
  onCancel: () => void;
  onSalvar: (dados: ChamadoFormData) => Promise<void>;
}) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        clienteId,
        titulo,
        descricao: descricao || null,
        solicitante: solicitante || null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o Chamado.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-lg rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Novo Chamado</h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
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
                clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Título *</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="input w-full"
              placeholder="Ex: Vazamento no térreo"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="input min-h-20 w-full resize-y"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Solicitante</span>
            <input
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              className="input w-full"
              placeholder="Ex: João Silva (síndico)"
            />
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !clienteId || !titulo.trim()}
            className="h-9 rounded-[6px] bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Criar Chamado"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GerarOsModal({
  chamado,
  destino,
  dadosOs,
  onCancel,
  onConfirmar,
}: {
  chamado: Chamado;
  destino: "convertido_os" | "backlog";
  dadosOs: DadosAberturaOs;
  onCancel: () => void;
  onConfirmar: (campos: {
    tipoTarefaId: string;
    tecnicoId: string | null;
    dataPrevista: string | null;
  }) => Promise<void>;
}) {
  const [tipoTarefaId, setTipoTarefaId] = useState(dadosOs.tiposTarefa[0]?.id ?? "");
  const [tecnicoId, setTecnicoId] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({
        tipoTarefaId,
        tecnicoId: tecnicoId || null,
        dataPrevista: dataPrevista || null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a OS.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-lg rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {destino === "convertido_os" ? "Gerar OS" : "Enviar ao backlog"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-ink-2">
            {chamado.numero} · {chamado.titulo}
          </p>
          <div className="block">
            <label
              htmlFor="chamado-gerar-os-tipo-tarefa"
              className="mb-1 block text-xs font-semibold text-ink-3"
            >
              Tipo de tarefa *
            </label>
            {dadosOs.tiposTarefa.length === 0 ? (
              <p className="text-xs text-ink-3">
                Nenhum tipo de tarefa cadastrado. Cadastre em PCM → Cadastros → Tipos de Tarefa.
              </p>
            ) : (
              <select
                id="chamado-gerar-os-tipo-tarefa"
                value={tipoTarefaId}
                onChange={(e) => setTipoTarefaId(e.target.value)}
                className="input w-full"
              >
                {dadosOs.tiposTarefa.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Técnico responsável</span>
            <select
              value={tecnicoId}
              onChange={(e) => setTecnicoId(e.target.value)}
              className="input w-full"
            >
              <option value="">Sem técnico</option>
              {dadosOs.tecnicos.map((tecnico) => (
                <option key={tecnico.id} value={tecnico.id}>
                  {tecnico.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Data prevista</span>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="input w-full"
            />
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando || !tipoTarefaId}
            className="h-9 rounded-[6px] bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelarChamadoModal({
  chamado,
  onCancel,
  onConfirmar,
}: {
  chamado: Chamado;
  onCancel: () => void;
  onConfirmar: (justificativa: string, anexo: File | null) => Promise<void>;
}) {
  const [justificativa, setJustificativa] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar(justificativa, anexo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar o Chamado.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-lg rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Cancelar Chamado</h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-ink-2">
            {chamado.numero} · {chamado.titulo}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Justificativa *</span>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="input min-h-24 w-full resize-y"
              placeholder="Ex: print de WhatsApp autorizando o cancelamento em anexo"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-semibold text-ink-3">Anexo (opcional)</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-secondary"
            >
              {anexo ? anexo.name : "Escolher arquivo"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
            />
          </div>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Voltar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando || !justificativa.trim()}
            className="h-9 rounded-[6px] bg-[#C5362B] px-3 text-sm font-semibold text-white hover:bg-[#A12D24] disabled:opacity-50"
          >
            {salvando ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
