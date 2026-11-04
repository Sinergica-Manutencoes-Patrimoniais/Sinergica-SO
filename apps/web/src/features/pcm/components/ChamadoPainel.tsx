// ChamadoPainel.tsx — E01-S118 T7. Dentro do modal de detalhe do card no board da Operação: quando
// a OS (ou o card) tem `chamadoId`, carrega o Chamado vinculado e mostra o histórico de atendimento
// (WhatsApp/Zé), as 3 datas (abertura/planejada/execução) e — enquanto o Chamado ainda está aberto
// — as ações de gerar OS / enviar ao backlog / cancelar.
//
// REQUISITO (Lucas, 2026-07-29): o histórico continua acessível MESMO depois do Chamado virar OS —
// por isso o painel carrega sempre pelo `chamadoId`, independente do status do Chamado.
import { Button, Modal, Skeleton } from "@sinergica/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { supabase } from "../../../lib/supabase-client";
import {
  cancelarChamado,
  definirDataPlanejadaChamado,
  gerarOsDoChamado,
  gerarOsDoChamadoNoStatus,
  marcarExecucaoChamado,
  obterChamado,
} from "../application/chamados";
import type { DadosAberturaOs } from "../application/ordem-servico-gateway";
import { type Chamado, ORIGEM_CHAMADO_LABEL, STATUS_CHAMADO_LABEL } from "../domain/chamados";
import { type StatusOrdemServico, auvoTaskDeepLink } from "../domain/ordens-servico";
import { supabaseChamadosAdapter } from "../infrastructure/supabase-chamados-adapter";
import { supabaseChamadosOsLeituraAdapter } from "../infrastructure/supabase-chamados-os-leitura-adapter";
import { supabaseChamadosOsComandoAdapter } from "../infrastructure/supabase-chamados-os-comando-adapter";
import { converterChamadoIntegral, listarComponentesConversao } from "../infrastructure/supabase-conversao-integral-adapter";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";
import { EntradaOrdensChamado } from "../interfaces/chamados-os/OrdensDoChamado";
import { CriarOsChamado } from "../interfaces/chamados-os/CriarOsChamado";
import { CanonicalizarVinculoLegado } from "../interfaces/chamados-os/CanonicalizarVinculoLegado";
import { ConversaoIntegral } from "../interfaces/chamados-os/ConversaoIntegral";
import { AvaliacaoEscopo } from "../interfaces/chamados-os/AvaliacaoEscopo";
import { GestaoEscopo } from "../interfaces/chamados-os/GestaoEscopo";
import { AnotacoesChamado } from "./AnotacoesChamado";
import { HistoricoAtendimentoChamado } from "./HistoricoAtendimentoChamado";
import { GerarOsModal } from "./GerarOsModal";

type SubModal =
  | {
      modo: "gerar-os";
      destino: "convertido_os" | "backlog";
      statusDestino?: Exclude<StatusOrdemServico, "solicitacao">;
    }
  | { modo: "cancelar" }
  | null;

export function ChamadoPainel({
  chamadoId,
  dadosOs,
  temEscrita,
  onMutou,
  auvoTaskId,
  destinoConversao = null,
  onConversaoFinalizada,
  onOsPlanejada,
  onAbrirOsVinculada,
}: {
  chamadoId: string;
  dadosOs: DadosAberturaOs | null;
  temEscrita: boolean;
  /** Chamado ao qual a ação alterou algo relevante pro board (gerou OS, cancelou) — refetch. */
  onMutou: () => void;
  auvoTaskId: number | null;
  /** E01-S124: drop de card sintético abre o formulário já com a coluna de destino. */
  destinoConversao?: Exclude<StatusOrdemServico, "solicitacao"> | null;
  onConversaoFinalizada?: () => void;
  /** E01-S125: conversão por drop para Planejamento ainda pede abertura Auvo, sem trigger. */
  onOsPlanejada?: (osId: string) => void;
  onAbrirOsVinculada?: (clienteId: string, osId: string) => void;
}) {
  const { user } = useAuth();
  const [subModal, setSubModal] = useState<SubModal>(null);
  const consulta = useQuery({
    queryKey: ["chamado-painel", user?.id, chamadoId], enabled: !!user?.id, gcTime: 0,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== user?.id || signal.aborted) throw new Error("Sessão alterada.");
      const resultado = await obterChamado(supabaseChamadosAdapter, chamadoId);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== user?.id || signal.aborted) throw new Error("Sessão alterada.");
      if (resultado && resultado.id !== chamadoId) throw new Error("Chamado divergente.");
      return resultado;
    },
  });
  const chamado = !consulta.isFetching && !consulta.isError ? consulta.data ?? null : null;
  const erro = consulta.isError ? "Não foi possível carregar o Chamado." : null;
  const carregarChamado = async () => { await consulta.refetch(); };

  useEffect(() => {
    setSubModal(null);
  }, [user?.id, chamadoId]);

  useEffect(() => {
    if (import.meta.env.VITE_SSO_CONVERSAO_INTEGRAL_ENABLED === "true" || !destinoConversao || !dadosOs || !temEscrita || chamado?.status !== "aberto") return;
    setSubModal({
      modo: "gerar-os",
      destino: destinoConversao === "backlog" ? "backlog" : "convertido_os",
      statusDestino: destinoConversao,
    });
  }, [chamado?.status, dadosOs, destinoConversao, temEscrita]);

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
    statusDestino?: Exclude<StatusOrdemServico, "solicitacao">,
  ) {
    if (!user || !chamado) return;
    const input = {
      categoria: "corretiva" as const,
      prioridade: "media" as const,
      gravidade: campos.gravidade,
      urgencia: campos.urgencia,
      tendencia: campos.tendencia,
      dorCliente: null,
      observacao: null,
      localDescricao: null,
      solicitante: chamado.solicitante,
      origem: "manual" as const,
      tecnicoId: campos.tecnicoId,
      tipoTarefaId: campos.tipoTarefaId,
      dataPrevista: campos.dataPrevista,
    };
    if (statusDestino) {
      const criada = await gerarOsDoChamadoNoStatus(
        supabaseChamadosAdapter,
        supabaseOrdemServicoAdapter,
        supabaseHubOsAdapter,
        chamado,
        input,
        user.id,
        statusDestino,
      );
      if (statusDestino === "planejamento") onOsPlanejada?.(criada.id);
    } else {
      await gerarOsDoChamado(
        supabaseChamadosAdapter,
        supabaseOrdemServicoAdapter,
        chamado,
        input,
        user.id,
        destino,
      );
    }
    setSubModal(null);
    await carregarChamado();
    onMutou();
    onConversaoFinalizada?.();
  }

  async function confirmarCancelar(justificativa: string, anexo: File | null) {
    if (!user || !chamado) return;
    await cancelarChamado(supabaseChamadosAdapter, chamado, justificativa, anexo, user.id);
    setSubModal(null);
    await carregarChamado();
    onMutou();
  }

  if (consulta.isFetching) {
    return <Skeleton className="h-4 w-40" />;
  }
  if (!chamado) {
    return (
      <div className="px-4 py-3 text-caption text-ink-3">
        {erro ?? (user ? "Chamado vinculado não encontrado." : "Sessão indisponível.")}
        {erro && <button type="button" onClick={() => void carregarChamado()}> Tentar novamente</button>}
      </div>
    );
  }

  const podeAgir = temEscrita && chamado.status === "aberto";
  const linkAuvo = auvoTaskDeepLink(auvoTaskId);

  return (
    <div className="rounded-lg border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2.5">
        <span className="text-micro font-semibold uppercase tracking-wider text-ink-3">
          Chamado
        </span>
        <span className="font-brand text-caption tabular-nums text-ink-3">{chamado.numero}</span>
        <span className="rounded-full bg-line-soft px-2 py-0.5 text-micro font-semibold text-ink-2">
          {STATUS_CHAMADO_LABEL[chamado.status]}
        </span>
        <span className="rounded-full bg-line-soft px-2 py-0.5 text-micro font-semibold text-ink-2">
          {ORIGEM_CHAMADO_LABEL[chamado.origem]}
        </span>
        {linkAuvo ? (
          <a
            href={linkAuvo}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-orange-soft px-2 py-0.5 text-micro font-semibold text-orange hover:underline"
          >
            Auvo #{auvoTaskId}
          </a>
        ) : (
          <span className="rounded-full bg-line-soft px-2 py-0.5 text-micro font-semibold text-ink-2">
            Vínculo Auvo da OS atual não informado
          </span>
        )}
      </div>

      <DetalheChamado
        key={chamado.id}
        chamado={chamado}
        podeEditar={temEscrita}
        onSalvarPlanejamento={salvarPlanejamento}
        onSalvarExecucao={salvarExecucao}
      />

      {user && (
        <EntradaOrdensChamado
          habilitado={import.meta.env.VITE_SSO_ORDENS_CHAMADO_ENABLED}
          usuario={user.id}
          cliente={chamado.clienteId}
          chamado={chamado.id}
          chamadoEsperado={chamadoId}
          leitura={supabaseChamadosOsLeituraAdapter}
          onAbrirOs={onAbrirOsVinculada ? (osId) => onAbrirOsVinculada(chamado.clienteId, osId) : undefined}
        />
      )}

      {user && temEscrita && (
        <CriarOsChamado habilitado={import.meta.env.VITE_SSO_CRIAR_OS_CHAMADO_ENABLED}
          usuario={user.id} cliente={chamado.clienteId} chamado={chamado.id}
          chamadoEsperado={chamadoId} gateway={supabaseChamadosOsComandoAdapter}
          aoConcluir={() => { void carregarChamado(); onMutou(); }} />
      )}
      {user && temEscrita && chamado.id === chamadoId && <CanonicalizarVinculoLegado
        usuario={user.id} cliente={chamado.clienteId} chamado={chamado.id} />}
      {user && temEscrita && <ConversaoIntegral habilitado={import.meta.env.VITE_SSO_CONVERSAO_INTEGRAL_ENABLED}
        usuario={user.id} cliente={chamado.clienteId} chamado={chamado.id} chamadoEsperado={chamadoId}
        chamadoCompleto={chamado} dadosOs={dadosOs} statusHubInicial={destinoConversao}
        listarEquipamentos={listarComponentesConversao}
        consultarRevisao={supabaseChamadosOsComandoAdapter.consultarRevisao} criar={converterChamadoIntegral}
        aoConcluir={(pedido) => { if (pedido.statusHub === "planejamento") onOsPlanejada?.(pedido.osId); void carregarChamado(); onMutou(); onConversaoFinalizada?.(); }} />}
      {destinoConversao && import.meta.env.VITE_SSO_CONVERSAO_INTEGRAL_ENABLED === "true" && <p>Confirme o movimento no formulário de conversão integral acima.</p>}
      {user && <AvaliacaoEscopo habilitado={import.meta.env.VITE_SSO_ESCOPO_CHAMADO_ENABLED}
        usuario={user.id} cliente={chamado.clienteId} chamado={chamado.id} chamadoEsperado={chamadoId} />}
      {user && <GestaoEscopo usuario={user.id} cliente={chamado.clienteId} chamado={chamado.id} chamadoEsperado={chamadoId} />}

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
          {import.meta.env.VITE_SSO_CONVERSAO_INTEGRAL_ENABLED !== "true" && <><Button
            variant="primary"
            size="sm"
            onClick={() => setSubModal({ modo: "gerar-os", destino: "convertido_os" })}
          >
            Gerar OS
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSubModal({ modo: "gerar-os", destino: "backlog" })}
          >
            Enviar ao backlog
          </Button></>}
          <Button variant="danger" size="sm" onClick={() => setSubModal({ modo: "cancelar" })}>
            Cancelar Chamado
          </Button>
        </div>
      )}

      {erro && <p className="px-4 pb-3 text-caption text-danger">{erro}</p>}

      {subModal?.modo === "gerar-os" && dadosOs && (
        <GerarOsModal
          chamado={chamado}
          destino={subModal.destino}
          dadosOs={dadosOs}
          onCancel={() => {
            setSubModal(null);
            onConversaoFinalizada?.();
          }}
          onConfirmar={(campos) =>
            confirmarGerarOs(subModal.destino, campos, subModal.statusDestino)
          }
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
    <div className="flex flex-col gap-3 px-4 py-3 text-body">
      <div>
        <span className="block text-caption font-semibold text-ink-3">Solicitação</span>
        <p className="whitespace-pre-wrap text-ink-2">{chamado.descricao || "—"}</p>
      </div>
      <div>
        <span className="block text-caption font-semibold text-ink-3">Local</span>
        <p className="whitespace-pre-wrap text-ink-2">{chamado.local || "—"}</p>
      </div>
      {chamado.fotoUrls.length > 0 && (
        <div>
          <span className="mb-1 block text-xs font-semibold text-ink-3">
            Fotos ({chamado.fotoUrls.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {chamado.fotoUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt=""
                  className="h-16 w-16 rounded-md border border-line object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <span className="block text-caption font-semibold text-ink-3">Abertura</span>
          <p className="text-ink-2">{new Date(chamado.createdAt).toLocaleDateString("pt-BR")}</p>
        </div>
        <div>
          <span className="mb-1 block text-caption font-semibold text-ink-3">
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
                className="input h-8 w-full text-caption"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!planejada || salvandoPlanejada}
                loading={salvandoPlanejada}
                onClick={async () => {
                  setSalvandoPlanejada(true);
                  try {
                    await onSalvarPlanejamento(new Date(planejada).toISOString());
                  } finally {
                    setSalvandoPlanejada(false);
                  }
                }}
              >
                Salvar
              </Button>
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
          <span className="mb-1 block text-caption font-semibold text-ink-3">Execução (real)</span>
          {podeEditar ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={execucao}
                onChange={(e) => setExecucao(e.target.value)}
                className="input h-8 w-full text-caption"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!execucao || salvandoExecucao}
                loading={salvandoExecucao}
                onClick={async () => {
                  setSalvandoExecucao(true);
                  try {
                    await onSalvarExecucao(new Date(execucao).toISOString());
                  } finally {
                    setSalvandoExecucao(false);
                  }
                }}
              >
                Salvar
              </Button>
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
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      titulo="Cancelar Chamado"
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-ink-2">
          {chamado.numero} · {chamado.titulo}
        </p>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Justificativa *</span>
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            className="input min-h-24 w-full resize-y"
            placeholder="Ex: print de WhatsApp autorizando o cancelamento em anexo"
          />
        </label>
        <div>
          <span className="mb-1 block text-caption font-semibold text-ink-3">Anexo (opcional)</span>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            {anexo ? anexo.name : "Escolher arquivo"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
          />
        </div>
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
          <Button variant="secondary" onClick={onCancel}>
            Voltar
          </Button>
          <Button
            variant="danger"
            onClick={confirmar}
            disabled={salvando || !justificativa.trim()}
            loading={salvando}
          >
            {salvando ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
