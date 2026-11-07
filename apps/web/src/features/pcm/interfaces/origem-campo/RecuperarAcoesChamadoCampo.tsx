import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { pedidoTriagemChamadoCampoSchema } from "./TriagemChamadoProvisorio";
import { pedidoUniaoChamadoCampoSchema } from "./UnirChamadoCampo";
import { pedidoCancelamentoChamadoCampoSchema } from "./CancelarChamadoCampo";

const fontes = [
  { tipo: "triagem", prefixo: "sso-triagem-chamado-campo:", schema: pedidoTriagemChamadoCampoSchema },
  { tipo: "uniao", prefixo: "sso-uniao-chamado-campo:", schema: pedidoUniaoChamadoCampoSchema },
  { tipo: "cancelamento", prefixo: "sso-cancelamento-chamado-campo:", schema: pedidoCancelamentoChamadoCampoSchema },
] as const;
type Tentativa =
  | { tipo: "triagem"; chave: string; texto: string; pedido: z.infer<typeof pedidoTriagemChamadoCampoSchema> }
  | { tipo: "uniao"; chave: string; texto: string; pedido: z.infer<typeof pedidoUniaoChamadoCampoSchema> }
  | { tipo: "cancelamento"; chave: string; texto: string; pedido: z.infer<typeof pedidoCancelamentoChamadoCampoSchema> };
const uuid = z.string().guid();

export function RecuperarAcoesChamadoCampo({ userId }: { userId: string }) {
  if (import.meta.env.VITE_SSO_TRIAGEM_CHAMADO_CAMPO_ENABLED !== "true" && import.meta.env.VITE_SSO_UNIAO_CHAMADO_CAMPO_ENABLED !== "true" && import.meta.env.VITE_SSO_CANCELAMENTO_CHAMADO_CAMPO_ENABLED !== "true") return null;
  return <Lista key={userId} userId={userId} />;
}
function Lista({ userId }: { userId: string }) {
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState(""); const [ocupado, setOcupado] = useState(false);
  const [, atualizar] = useState(0); const trava = useRef(false); const cache = useQueryClient(); const tentativas: Tentativa[] = []; let invalida = false;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chave = sessionStorage.key(i); if (!chave) continue;
      const fonte = fontes.find((f) => chave.startsWith(f.prefixo)); if (!fonte) continue;
      let contexto: unknown; try { contexto = JSON.parse(chave.slice(fonte.prefixo.length)); } catch { continue; }
      if (!Array.isArray(contexto) || contexto[0] !== userId) continue;
      try {
        const texto = sessionStorage.getItem(chave); if (!texto || new TextEncoder().encode(texto).length > 20_000) throw new Error();
        const pedido = fonte.schema.parse(JSON.parse(texto));
        if (contexto.length !== 3 || contexto[1] !== pedido.clienteId || contexto[2] !== pedido.osId) throw new Error();
        tentativas.push({ tipo: fonte.tipo, chave, texto, pedido } as Tentativa);
      } catch { invalida = true; }
    }
  } catch { invalida = true; }
  async function executar(t: Tentativa, modo: "consultar" | "repetir") {
    if (trava.current || (modo === "repetir" && confirmacao !== JSON.stringify([t.chave, t.texto]))) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(t.chave) !== t.texto) throw new Error();
      const outras = fontes.map((f) => `${f.prefixo}${JSON.stringify([userId, t.pedido.clienteId, t.pedido.osId])}`).filter((k) => k !== t.chave);
      if (outras.some((k) => sessionStorage.getItem(k) !== null)) throw new Error();
      let data: unknown; let error: unknown;
      if (modo === "consultar") {
        const p = t.pedido;
        const payload = t.tipo === "triagem" ? { clienteId: p.clienteId, osId: p.osId, chamadoRevision: t.pedido.chamadoRevision,
          triagemRevision: t.pedido.triagemRevision, acao: t.pedido.acao, titulo: t.pedido.titulo, descricao: t.pedido.descricao, motivo: p.motivo }
          : t.tipo === "uniao" ? { clienteId: p.clienteId, osId: p.osId, origemId: t.pedido.origemId, destinoId: t.pedido.destinoId,
            origemRevision: t.pedido.origemRevision, destinoRevision: t.pedido.destinoRevision, osUpdatedAt: t.pedido.osUpdatedAt,
            taskId: t.pedido.taskId, acao: t.pedido.acao, motivo: p.motivo }
          : { clienteId: p.clienteId, osId: p.osId, chamadoId: t.pedido.chamadoId, expectedRevision: t.pedido.revision,
            osUpdatedAt: t.pedido.osUpdatedAt, taskId: t.pedido.taskId, motivo: p.motivo };
        ({ data, error } = await supabase.schema("pcm").rpc("sso_consultar_acao_chamado_campo", { p_ator_id: userId, p_cliente_id: p.clienteId,
          p_os_id: p.osId, p_request_id: p.requestId, p_tipo: t.tipo, p_payload: payload }));
      } else if (t.tipo === "triagem") {
        const p = t.pedido; ({ data, error } = await supabase.schema("pcm").rpc("sso_decidir_triagem_chamado_campo", { p_ator_id: userId, p_cliente_id: p.clienteId,
          p_os_id: p.osId, p_request_id: p.requestId, p_expected_chamado: p.chamadoRevision, p_expected_triagem: p.triagemRevision,
          p_acao: p.acao, p_titulo: p.titulo, p_descricao: p.descricao, p_motivo: p.motivo }));
      } else if (t.tipo === "uniao") {
        const p = t.pedido; ({ data, error } = await supabase.schema("pcm").rpc("sso_unir_chamado_campo", { p_ator_id: userId, p_cliente_id: p.clienteId,
          p_request_id: p.requestId, p_os_id: p.osId, p_origem_id: p.origemId, p_destino_id: p.destinoId, p_origem_revision: p.origemRevision,
          p_destino_revision: p.destinoRevision, p_os_updated_at: p.osUpdatedAt, p_task_id: p.taskId, p_acao: p.acao, p_motivo: p.motivo }));
      } else {
        const p = t.pedido; ({ data, error } = await supabase.schema("pcm").rpc("sso_cancelar_chamado_campo_preservado", { p_ator_id: userId, p_cliente_id: p.clienteId,
          p_request_id: p.requestId, p_os_id: p.osId, p_chamado_id: p.chamadoId, p_expected_revision: p.revision,
          p_os_updated_at: p.osUpdatedAt, p_task_id: p.taskId, p_motivo: p.motivo }));
      }
      if (error) throw error;
      const comum = z.object({ requestId: uuid, clienteId: uuid, osId: uuid, tarefaAlterada: z.literal(false) }).passthrough().parse(data);
      if (comum.requestId !== t.pedido.requestId || comum.clienteId !== t.pedido.clienteId || comum.osId !== t.pedido.osId) throw new Error();
      if (t.tipo === "triagem") {
        const r = z.object({ chamadoId: uuid, acao: z.enum(["confirmar", "corrigir"]), triagemRevision: z.number().int().positive().safe(), osAlterada: z.literal(false), validacaoPcmComprovada: z.literal(false) }).passthrough().parse(data);
        if (r.chamadoId !== t.pedido.chamadoId || r.acao !== t.pedido.acao || r.triagemRevision !== t.pedido.triagemRevision + 1) throw new Error();
      } else if (t.tipo === "uniao") {
        const r = z.object({ origemId: uuid, destinoId: uuid, acao: z.enum(["unir", "duplicidade"]), taskId: z.string(), execucaoAlterada: z.literal(false) }).passthrough().parse(data);
        if (r.origemId !== t.pedido.origemId || r.destinoId !== t.pedido.destinoId || r.acao !== t.pedido.acao || r.taskId !== t.pedido.taskId) throw new Error();
      } else {
        const r = z.object({ chamadoId: uuid, estado: z.literal("cancelado"), osAlterada: z.literal(false), execucaoAlterada: z.literal(false) }).passthrough().parse(data);
        if (r.chamadoId !== t.pedido.chamadoId) throw new Error();
      }
      await cache.invalidateQueries({ queryKey: ["estado-origem-campo", userId, t.pedido.clienteId], refetchType: "none" });
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || sessionStorage.getItem(t.chave) !== t.texto) throw new Error();
      sessionStorage.removeItem(t.chave); atualizar((n) => n + 1); setConfirmacao(null); setAviso("Pedido confirmado. Consulte o Chamado e a OS atualizados.");
      void cache.refetchQueries({ queryKey: ["estado-origem-campo", userId, t.pedido.clienteId], type: "active" });
    } catch { setAviso("Resultado não confirmado. A tentativa foi preservada; consulte suporte antes de outra ação."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <section aria-label="Recuperar ações de Chamado de campo">
    {invalida && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {tentativas.map((t) => <section key={t.pedido.requestId}><p>Ação {t.tipo} pendente para Cliente {t.pedido.clienteId} · OS {t.pedido.osId}.</p>
      <button type="button" disabled={ocupado} onClick={() => void executar(t, "consultar")}>Consultar recibo</button>
      {confirmacao === JSON.stringify([t.chave, t.texto]) ? <div><p>A repetição usa o pedido original; se ainda não foi aplicado, poderá efetivar a ação.</p>
        <button type="button" disabled={ocupado} onClick={() => void executar(t, "repetir")}>Confirmar repetição</button><button type="button" disabled={ocupado} onClick={() => setConfirmacao(null)}>Cancelar</button></div> :
        <button type="button" disabled={ocupado} onClick={() => setConfirmacao(JSON.stringify([t.chave, t.texto]))}>Repetir mesma ação</button>}
    </section>)}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
