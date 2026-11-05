import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const dataCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pedidoSchema = z.object({ requestId: uuid, ator: uuid, cliente: uuid, visita: uuid, revisao: z.number().int().positive(), data: dataCivil, origem: z.string().trim().min(1).max(500), natureza: z.string().trim().min(1).max(200), motivo: z.string().trim().min(1).max(2000), tentativaIncerta: z.boolean().optional() }).strict();
const estadoSchema = z.object({ visitaId: uuid, aprovada: z.boolean(), revisaoAtual: z.number().int().positive(), dataAtual: dataCivil, requestId: uuid.optional(), revisaoVisita: z.number().int().positive().optional(), data: dataCivil.optional(), origem: z.string().optional(), natureza: z.string().optional(), motivo: z.string().optional(), atorId: uuid.optional(), aprovadaEm: z.string().optional() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; visitaId: string; aoAprovar: () => void };

export function ExcecaoVisita(props: Props) {
  if (import.meta.env.VITE_SSO_EXCECAO_VISITA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId])} {...props} />;
}
function Conteudo({ userId, clienteId, visitaId, aoAprovar }: Props) {
  const chave = `sso-excecao-visita:${JSON.stringify([userId, clienteId, visitaId])}`;
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.ator === userId && p.cliente === clienteId && p.visita === visitaId ? p : "invalido"; } catch { return "invalido"; } });
  const [origem, setOrigem] = useState(""); const [natureza, setNatureza] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState(""); const trava = useRef(false); const cache = useQueryClient();
  async function conferirAtor() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId) throw new Error("Sessão alterada"); }
  const estado = useQuery({ queryKey: ["excecao-visita", userId, clienteId, visitaId], enabled: !pedido, gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    await conferirAtor(); const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_excecao_visita", { p_ator: userId, p_cliente: clienteId, p_visita: visitaId }).abortSignal(signal);
    if (error) throw error; const r = estadoSchema.parse(data); if (r.visitaId !== visitaId || (r.aprovada && (!r.requestId || !r.data || !r.origem || !r.natureza || !r.motivo))) throw new Error("Resposta divergente"); await conferirAtor(); if (signal.aborted) throw new Error("Consulta cancelada"); return r;
  } });
  const assinatura = estado.data && !estado.data.aprovada ? JSON.stringify([userId, clienteId, visitaId, estado.data.revisaoAtual, estado.data.dataAtual, origem.trim(), natureza.trim(), motivo.trim()]) : null;
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso(""); let serializado = JSON.stringify(p);
    try { await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Pedido alterado");
      const jaIncerta = p.tentativaIncerta !== false; p = pedidoSchema.parse({ ...p, tentativaIncerta: true }); serializado = JSON.stringify(p); sessionStorage.setItem(chave, serializado); setPedido(p);
      const { data, error } = await supabase.schema("pcm").rpc("sso_aprovar_excecao_visita", { p_ator: p.ator, p_request: p.requestId, p_cliente: p.cliente, p_visita: p.visita, p_revisao: p.revisao, p_data: p.data, p_origem: p.origem, p_natureza: p.natureza, p_motivo: p.motivo });
      if (error) {
        if (!jaIncerta && (error.code === "40001" || (error.code === "P0011" && error.message === "visita_obsoleta"))) {
          await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Pedido alterado");
          sessionStorage.removeItem(chave); setPedido(null); setConfirmacao(null); setAviso("A Visita mudou. Confira os dados novamente."); void estado.refetch(); return;
        }
        throw error;
      }
      if (!data || data.requestId !== p.requestId || data.visitaId !== p.visita || data.revisaoVisita !== p.revisao || data.aprovada !== true || data.visitaAlterada !== false || data.osAlteradas !== false || data.tarefaAuvoCriada !== false) throw new Error("Recibo divergente");
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Pedido alterado"); sessionStorage.removeItem(chave); setPedido(null); setConfirmacao(null); setAviso("Exceção aprovada. A Visita será preservada na mudança de dia.");
      await cache.invalidateQueries({ queryKey: ["excecao-visita", userId, clienteId, visitaId] }); aoAprovar();
    } catch { setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); } finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() { if (!assinatura || confirmacao !== assinatura || !estado.data || estado.data.aprovada || pedido || trava.current) return; try {
    const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), ator: userId, cliente: clienteId, visita: visitaId, revisao: estado.data.revisaoAtual, data: estado.data.dataAtual, origem, natureza, motivo, tentativaIncerta: false }); if (sessionStorage.getItem(chave) !== null) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); setPedido(p); void enviar(p);
  } catch { setAviso("Não foi possível guardar o pedido. Nada foi enviado."); } }
  return <section aria-label="Exceção aprovada da Visita"><h5>Exceção da Visita {visitaId}</h5>
    {pedido === "invalido" ? <p role="alert">Pedido guardado inválido. Procure suporte.</p> : pedido ? <><p>Pedido pendente; o resultado pode ser incerto.</p><button type="button" disabled={ocupado} onClick={() => void enviar(pedido)}>Repetir mesma aprovação</button></> : <>
      {estado.isFetching && <p role="status">Consultando exceção…</p>}{estado.isError && <p role="alert">Não foi possível consultar a exceção. <button type="button" onClick={() => void estado.refetch()}>Tentar novamente</button></p>}
      {estado.data?.aprovada ? <p>Exceção aprovada para {estado.data.data}: {estado.data.natureza} · origem {estado.data.origem} · motivo {estado.data.motivo}.</p> : estado.data && <><p>Data local {estado.data.dataAtual} · revisão {estado.data.revisaoAtual}. A aprovação preserva esta Visita na mudança de dia.</p>
        <label>Origem <input maxLength={500} value={origem} onChange={(e) => { setOrigem(e.target.value); setConfirmacao(null); }} /></label><label>Natureza <input maxLength={200} value={natureza} onChange={(e) => { setNatureza(e.target.value); setConfirmacao(null); }} /></label><label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
        <label><input type="checkbox" checked={!!assinatura && confirmacao === assinatura} disabled={!origem.trim() || !natureza.trim() || !motivo.trim() || estado.isFetching} onChange={(e) => setConfirmacao(e.target.checked ? assinatura : null)} /> Conferi a Visita e aprovo a exceção.</label><button type="button" disabled={!assinatura || confirmacao !== assinatura || estado.isFetching || ocupado} onClick={iniciar}>Aprovar exceção</button></>}
    </>}{aviso && <p role="status">{aviso}</p>}</section>;
}
