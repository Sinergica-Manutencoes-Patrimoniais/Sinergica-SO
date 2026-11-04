import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const linha = z.object({ ciclo_id: uuid, preparada_id: uuid, estado: z.enum(["aguardando", "verificacao", "cancelado"]),
  revisao: z.number().int().positive(), vencimento: z.string().date(), atualizado_em: z.string().datetime({ offset: true }), situacao_atual: z.enum(["conferida", "verificacao", "cancelada"]).optional() }).strict();
const pedidoSchema = z.object({ requestId: uuid, clienteId: uuid, planoId: uuid, preparadaId: uuid, contextoPreparadaId: uuid.optional(),
  acao: z.enum(["incluir", "cancelar", "confirmar"]), revisao: z.number().int().nonnegative(), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function FilaPreventivaPcm(props: { userId: string; clienteId: string; planoId: string; preparadaId: string; tipo?: "calendario" | "visita" }) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.preparadaId, props.tipo ?? "calendario"])} {...props} />;
}
function Conteudo({ userId, clienteId, planoId, preparadaId, tipo = "calendario" }: { userId: string; clienteId: string; planoId: string; preparadaId: string; tipo?: "calendario" | "visita" }) {
  const chave = `${tipo === "visita" ? "sso-fila-visita" : "sso-fila-preventiva-pcm"}:${JSON.stringify([userId, clienteId, planoId, preparadaId])}`;
  const cache = useQueryClient(); const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false); const [motivo, setMotivo] = useState("");
  const [operacao, setOperacao] = useState<"cancelar" | "confirmar">("cancelar");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const valor = sessionStorage.getItem(chave); if (!valor) return null; const p = pedidoSchema.parse(JSON.parse(valor));
    return p.clienteId === clienteId && p.planoId === planoId && (p.contextoPreparadaId ?? p.preparadaId) === preparadaId ? p : "invalido";
  } catch { return "invalido"; } });
  async function sessao(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const lista = useQuery({ queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId, "preparada", preparadaId, tipo], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await sessao(signal); const { data, error } = await supabase.schema("pcm").rpc(tipo === "visita" ? "sso_consultar_fila_visita_v2" : "sso_consultar_entrada_fila_preventiva", {
        p_cliente_id: clienteId, p_plano_id: planoId, p_preparada_id: preparadaId,
      }).abortSignal(signal);
      if (error) throw error; const itens = z.array(linha).max(2).parse(data); let anterior = "";
      for (const item of itens) {
        if (tipo === "visita" && !item.situacao_atual) throw new Error("Situação indisponível.");
        if (item.ciclo_id.toLowerCase() <= anterior) throw new Error("Entrada divergente.");
        anterior = item.ciclo_id.toLowerCase();
      }
      await sessao(signal); return itens;
    } });
  const existentes = lista.data ?? [];
  const visivel = !!lista.data && !lista.isFetching && !lista.isError;
  const registro = existentes.length === 1 ? existentes[0] : undefined;
  const outraOcorrencia = !!registro && registro.preparada_id.toLowerCase() !== preparadaId.toLowerCase();
  const acao = registro && registro.estado !== "cancelado" ? (registro.estado === "verificacao" && import.meta.env.VITE_SSO_CONFIRMAR_FILA_PREVENTIVA_ENABLED === "true" ? operacao : "cancelar") : "incluir";
  const fotografia = JSON.stringify([userId, clienteId, planoId, preparadaId, registro ?? null, acao, motivo.trim()]);
  async function enviar(p: Pedido, primeiraTentativa = false) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso("");
    try {
      await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      const parametros = { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_plano_id: p.planoId, p_preparada_id: p.preparadaId,
        p_expected_revision: p.revisao, p_motivo: p.motivo };
      const rpc = tipo === "visita" ? "sso_alterar_fila_visita" : p.acao === "confirmar" ? "sso_confirmar_fila_preventiva" : "sso_alterar_fila_preventiva_pcm";
      const { data, error } = await supabase.schema("pcm").rpc(rpc,
        tipo === "visita" || p.acao !== "confirmar" ? { ...parametros, p_acao: p.acao } : parametros);
      if (error) throw error;
      const r = z.object({ requestId: uuid, clienteId: uuid, planoId: uuid, preparadaId: uuid, cicloId: uuid,
        estado: z.enum(["aguardando", "verificacao", "cancelado"]), revision: z.number().int().positive(), osCriada: z.literal(false), tarefaAuvoCriada: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.clienteId !== clienteId || r.planoId !== planoId || r.preparadaId !== p.preparadaId ||
        r.revision !== p.revisao + 1 || (p.acao === "incluir" ? !["aguardando", "verificacao"].includes(r.estado) : r.estado !== (p.acao === "confirmar" ? "aguardando" : "cancelado"))) throw new Error("Recibo divergente.");
      await sessao(); await cache.invalidateQueries({ queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId] }); await sessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo("");
      setAviso(p.acao === "incluir" ? (r.estado === "verificacao" ? "Ciclo incluído para conferência: ausência de vínculo não comprova ausência de execução. Nenhuma OS ou tarefa Auvo foi criada." : "Ciclo registrado na fila local; nenhuma OS ou tarefa Auvo foi criada.") : p.acao === "confirmar" ? "Entrada confirmada como aguardando; nenhuma OS ou tarefa Auvo foi criada." : "Entrada da fila local cancelada; fonte preventiva e OS não foram alteradas.");
    } catch (error) {
      const rejeicaoContinuidade = primeiraTentativa && p.acao !== "cancelar" && typeof error === "object" && error !== null && "code" in error && error.code === "23514" && "message" in error && typeof error.message === "string" && ["vigencia_ocorrencia_indeterminada", "escopo_retirado_ou_indeterminado", "continuidade_ciclo_nao_aprovada", "continuidade_visita_nao_aprovada", "snapshot_indisponivel"].includes(error.message);
      if (rejeicaoContinuidade) {
        try {
          await sessao();
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
          sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setOperacao("cancelar");
          setAviso("A continuidade não está comprovada. Confira a revisão; você pode cancelar esta entrada da fila sem alterar a OS.");
          await cache.invalidateQueries({ queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId] }).catch(() => undefined);
        } catch { setAviso("Tentativa preservada; procure suporte para reconciliar a sessão."); }
      } else setAviso("Resultado não confirmado. Preserve a tentativa e consulte suporte em caso de conflito.");
    }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (!visivel || existentes.length > 1 || pendente || trava.current || registro?.estado === "cancelado" || confirmacao !== fotografia || !motivo.trim()) return;
    try {
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, planoId, preparadaId: registro?.preparada_id ?? preparadaId,
        ...(outraOcorrencia ? { contextoPreparadaId: preparadaId } : {}), acao, revisao: registro?.revisao ?? 0, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p, true);
    } catch { setAviso("Não foi possível guardar o pedido; nada foi enviado."); }
  }
  return <section aria-label="Fila preventiva local"><h5>Fila preventiva local</h5>
    <p>O servidor classifica a fonte; ciclo sem vínculo pode ser incluído somente para verificação, sem comprovar ausência de execução. Cancelar esta entrada não cancela a fonte ou uma OS; não cria tarefa Auvo.</p>
    {lista.isFetching && <output>Consultando fila…</output>}
    {lista.isError && <p role="alert">Fila indisponível. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {visivel && <p>{existentes.length > 1 ? "Identidade ambígua; procure suporte." : registro ? `Entrada ${registro.estado} · revisão ${registro.revisao}.` : "Nenhuma entrada registrada para o ciclo canônico consultado."}</p>}
    {visivel && tipo === "visita" && registro?.situacao_atual === "verificacao" && <p role="alert">Fonte ou vigência exigem nova conferência. O estado registrado não comprova que o ciclo continua aguardando.</p>}
    {visivel && tipo === "visita" && registro?.situacao_atual === "conferida" && <p>Situação atual parcialmente conferida; fontes externas ainda exigem atenção.</p>}
    {visivel && outraOcorrencia && <p role="status">Este ciclo foi registrado pela ocorrência {registro?.preparada_id}. A ação usará a ocorrência original e preservará esta versão.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button> : !pendente && <>
      {registro?.estado === "verificacao" && import.meta.env.VITE_SSO_CONFIRMAR_FILA_PREVENTIVA_ENABLED === "true" && <label>Ação <select value={operacao} disabled={!visivel || ocupado} onChange={(e) => { setOperacao(e.target.value as "cancelar" | "confirmar"); setConfirmacao(null); }}><option value="cancelar">Cancelar entrada</option><option value="confirmar">Reconferir fonte e marcar aguardando</option></select></label>}
      <label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === fotografia} disabled={!visivel || ocupado || existentes.length > 1 || registro?.estado === "cancelado"} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi a ocorrência e a ação na fila local.</label>
      <button type="button" disabled={!visivel || ocupado || existentes.length > 1 || registro?.estado === "cancelado" || !motivo.trim() || confirmacao !== fotografia} onClick={iniciar}>{acao === "incluir" ? "Incluir na fila local" : acao === "confirmar" ? "Reconferir e marcar aguardando" : "Cancelar entrada local"}</button>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
