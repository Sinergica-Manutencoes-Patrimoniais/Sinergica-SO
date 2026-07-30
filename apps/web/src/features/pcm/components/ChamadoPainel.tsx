// ChamadoPainel.tsx — E01-S118 T7. Dentro do modal de detalhe do card no board da Operação: quando
// a OS (ou o card) tem `chamadoId`, carrega o Chamado vinculado e mostra o histórico de atendimento
// (WhatsApp/Zé), as 3 datas (abertura/planejada/execução) e — enquanto o Chamado ainda está aberto
// — as ações de gerar OS / enviar ao backlog / cancelar.
//
// REQUISITO (Lucas, 2026-07-29): o histórico continua acessível MESMO depois do Chamado virar OS —
// por isso o painel carrega sempre pelo `chamadoId`, independente do status do Chamado.
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { useFormularioSujo } from "../../../app/use-formulario-sujo";
import {
  cancelarChamado,
  definirDataPlanejadaChamado,
  gerarOsDoChamado,
  marcarExecucaoChamado,
  obterChamado,
} from "../application/chamados";
import type { DadosAberturaOs } from "../application/ordem-servico-gateway";
import { type Chamado, ORIGEM_CHAMADO_LABEL, STATUS_CHAMADO_LABEL } from "../domain/chamados";
import { supabaseChamadosAdapter } from "../infrastructure/supabase-chamados-adapter";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";
import { AnotacoesChamado } from "./AnotacoesChamado";
import { HistoricoAtendimentoChamado } from "./HistoricoAtendimentoChamado";

type SubModal =
  | { modo: "gerar-os"; destino: "convertido_os" | "backlog" }
  | { modo: "cancelar" }
  | null;

export function ChamadoPainel({
  chamadoId,
  dadosOs,
  temEscrita,
  onMutou,
}: {
  chamadoId: string;
  dadosOs: DadosAberturaOs | null;
  temEscrita: boolean;
  /** Chamado ao qual a ação alterou algo relevante pro board (gerou OS, cancelou) — refetch. */
  onMutou: () => void;
}) {
  const { user } = useAuth();
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [subModal, setSubModal] = useState<SubModal>(null);

  const carregarChamado = useCallback(async () => {
    setCarregando(true);
    try {
      setChamado(await obterChamado(supabaseChamadosAdapter, chamadoId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o Chamado.");
    } finally {
      setCarregando(false);
    }
  }, [chamadoId]);

  useEffect(() => {
    carregarChamado();
  }, [carregarChamado]);

  async function salvarPlanejamento(data: string) {
    if (!user || !chamado) return;
    await definirDataPlanejadaChamado(supabaseChamadosAdapter, chamado, data, user.id);
    await carregarChamado();
  }

  async function salvarExecucao(data: string) {
    if (!user || !chamado) return;
    await marcarExecucaoChamado(supabaseChamadosAdapter, chamado, data, user.id);
    await carregarChamado();
  }

  async function confirmarGerarOs(
    destino: "convertido_os" | "backlog",
    campos: {
      tipoTarefaId: string;
      tecnicoId: string | null;
      dataPrevista: string | null;
      gravidade: number;
      urgencia: number;
      tendencia: number;
    },
  ) {
    if (!user || !chamado) return;
    await gerarOsDoChamado(
      supabaseChamadosAdapter,
      supabaseOrdemServicoAdapter,
      chamado,
      {
        categoria: "corretiva",
        prioridade: "media",
        gravidade: campos.gravidade,
        urgencia: campos.urgencia,
        tendencia: campos.tendencia,
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
    setSubModal(null);
    await carregarChamado();
    onMutou();
  }

  async function confirmarCancelar(justificativa: string, anexo: File | null) {
    if (!user || !chamado) return;
    await cancelarChamado(supabaseChamadosAdapter, chamado, justificativa, anexo, user.id);
    setSubModal(null);
    await carregarChamado();
    onMutou();
  }

  if (carregando) {
    return <div className="px-4 py-3 text-xs text-ink-3">Carregando Chamado…</div>;
  }
  if (!chamado) {
    return (
      <div className="px-4 py-3 text-xs text-ink-3">
        {erro ?? "Chamado vinculado não encontrado."}
      </div>
    );
  }

  const podeAgir = temEscrita && chamado.status === "aberto";

  return (
    <div className="rounded-[8px] border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
          Chamado
        </span>
        <span className="font-brand text-xs tabular-nums text-ink-3">{chamado.numero}</span>
        <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink-2">
          {STATUS_CHAMADO_LABEL[chamado.status]}
        </span>
        <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink-2">
          {ORIGEM_CHAMADO_LABEL[chamado.origem]}
        </span>
      </div>

      <DetalheChamado
        chamado={chamado}
        podeEditar={temEscrita}
        onSalvarPlanejamento={salvarPlanejamento}
        onSalvarExecucao={salvarExecucao}
      />

      <div className="border-t border-line-soft px-4 py-3">
        <HistoricoAtendimentoChamado gateway={supabaseChamadosAdapter} chamadoId={chamado.id} />
      </div>

      <div className="border-t border-line-soft px-4 py-3">
        <AnotacoesChamado
          chamadoId={chamado.id}
          gateway={supabaseChamadosAdapter}
          podeAdicionar={temEscrita}
        />
      </div>

      {podeAgir && (
        <div className="flex flex-wrap gap-2 border-t border-line-soft px-4 py-3">
          <button
            type="button"
            onClick={() => setSubModal({ modo: "gerar-os", destino: "convertido_os" })}
            className="h-8 rounded-[6px] bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-deep"
          >
            Gerar OS
          </button>
          <button
            type="button"
            onClick={() => setSubModal({ modo: "gerar-os", destino: "backlog" })}
            className="btn-secondary h-8 px-3 text-xs"
          >
            Enviar ao backlog
          </button>
          <button
            type="button"
            onClick={() => setSubModal({ modo: "cancelar" })}
            className="h-8 rounded-[6px] border border-[#F2C0B5] px-3 text-xs font-semibold text-[#A23B25] hover:bg-[#FFF4F1]"
          >
            Cancelar Chamado
          </button>
        </div>
      )}

      {erro && <p className="px-4 pb-3 text-xs text-[#A23B25]">{erro}</p>}

      {subModal?.modo === "gerar-os" && dadosOs && (
        <GerarOsModal
          chamado={chamado}
          destino={subModal.destino}
          dadosOs={dadosOs}
          onCancel={() => setSubModal(null)}
          onConfirmar={(campos) => confirmarGerarOs(subModal.destino, campos)}
        />
      )}
      {subModal?.modo === "cancelar" && (
        <CancelarChamadoModal
          chamado={chamado}
          onCancel={() => setSubModal(null)}
          onConfirmar={confirmarCancelar}
        />
      )}
    </div>
  );
}

/** E01-S101 AC-5/AC-2/AC-3/AC-4: Solicitação + Local (sem truncar) e as 3 datas
 * (abertura=imutável, planejada=editável/replanejável, execução=real). Extraído de ChamadosPage. */
function DetalheChamado({
  chamado,
  podeEditar,
  onSalvarPlanejamento,
  onSalvarExecucao,
}: {
  chamado: Chamado;
  podeEditar: boolean;
  onSalvarPlanejamento: (data: string) => Promise<void>;
  onSalvarExecucao: (data: string) => Promise<void>;
}) {
  const [planejada, setPlanejada] = useState(chamado.dataPlanejada?.slice(0, 10) ?? "");
  const [execucao, setExecucao] = useState(chamado.dataExecucao?.slice(0, 10) ?? "");
  const [salvandoPlanejada, setSalvandoPlanejada] = useState(false);
  const [salvandoExecucao, setSalvandoExecucao] = useState(false);

  return (
    <div className="flex flex-col gap-3 px-4 py-3 text-sm">
      <div>
        <span className="block text-xs font-semibold text-ink-3">Solicitação</span>
        <p className="whitespace-pre-wrap text-ink-2">{chamado.descricao || "—"}</p>
      </div>
      <div>
        <span className="block text-xs font-semibold text-ink-3">Local</span>
        <p className="whitespace-pre-wrap text-ink-2">{chamado.local || "—"}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <span className="block text-xs font-semibold text-ink-3">Abertura</span>
          <p className="text-ink-2">{new Date(chamado.createdAt).toLocaleDateString("pt-BR")}</p>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-ink-3">
            Planejada{" "}
            {chamado.replanejamentos > 0 && (
              <span className="text-ink-3">({chamado.replanejamentos}x replanejada)</span>
            )}
          </span>
          {podeEditar ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={planejada}
                onChange={(e) => setPlanejada(e.target.value)}
                className="input h-8 w-full text-xs"
              />
              <button
                type="button"
                disabled={!planejada || salvandoPlanejada}
                onClick={async () => {
                  setSalvandoPlanejada(true);
                  try {
                    await onSalvarPlanejamento(new Date(planejada).toISOString());
                  } finally {
                    setSalvandoPlanejada(false);
                  }
                }}
                className="btn-secondary h-8 shrink-0 px-2 text-xs"
              >
                Salvar
              </button>
            </div>
          ) : (
            <p className="text-ink-2">
              {chamado.dataPlanejada
                ? new Date(chamado.dataPlanejada).toLocaleDateString("pt-BR")
                : "—"}
            </p>
          )}
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-ink-3">Execução (real)</span>
          {podeEditar ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={execucao}
                onChange={(e) => setExecucao(e.target.value)}
                className="input h-8 w-full text-xs"
              />
              <button
                type="button"
                disabled={!execucao || salvandoExecucao}
                onClick={async () => {
                  setSalvandoExecucao(true);
                  try {
                    await onSalvarExecucao(new Date(execucao).toISOString());
                  } finally {
                    setSalvandoExecucao(false);
                  }
                }}
                className="btn-secondary h-8 shrink-0 px-2 text-xs"
              >
                Salvar
              </button>
            </div>
          ) : (
            <p className="text-ink-2">
              {chamado.dataExecucao
                ? new Date(chamado.dataExecucao).toLocaleDateString("pt-BR")
                : "—"}
            </p>
          )}
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
    gravidade: number;
    urgencia: number;
    tendencia: number;
  }) => Promise<void>;
}) {
  const [tipoTarefaId, setTipoTarefaId] = useState(dadosOs.tiposTarefa[0]?.id ?? "");
  const [tecnicoId, setTecnicoId] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [gravidade, setGravidade] = useState<number | "">(destino === "backlog" ? "" : 3);
  const [urgencia, setUrgencia] = useState<number | "">(destino === "backlog" ? "" : 3);
  const [tendencia, setTendencia] = useState<number | "">(destino === "backlog" ? "" : 3);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useFormularioSujo(
    {
      tipoTarefaId: dadosOs.tiposTarefa[0]?.id ?? "",
      tecnicoId: "",
      dataPrevista: "",
      gravidade: destino === "backlog" ? "" : 3,
      urgencia: destino === "backlog" ? "" : 3,
      tendencia: destino === "backlog" ? "" : 3,
    },
    { tipoTarefaId, tecnicoId, dataPrevista, gravidade, urgencia, tendencia },
  );

  const gutCompleto = gravidade !== "" && urgencia !== "" && tendencia !== "";

  async function confirmar() {
    if (!gutCompleto) return;
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({
        tipoTarefaId,
        tecnicoId: tecnicoId || null,
        dataPrevista: dataPrevista || null,
        gravidade: gravidade as number,
        urgencia: urgencia as number,
        tendencia: tendencia as number,
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
          {destino === "backlog" && (
            <div className="grid grid-cols-3 gap-2">
              <GutSelect label="Gravidade *" value={gravidade} onChange={setGravidade} />
              <GutSelect label="Urgência *" value={urgencia} onChange={setUrgencia} />
              <GutSelect label="Tendência *" value={tendencia} onChange={setTendencia} />
            </div>
          )}
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
            disabled={salvando || !tipoTarefaId || !gutCompleto}
            className="h-9 rounded-[6px] bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GutSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        className="input w-full"
      >
        <option value="">—</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
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
