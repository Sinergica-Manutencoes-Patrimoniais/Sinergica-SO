import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const pedidoSchema = z.object({ requestId: uuid, cliente: uuid, declaracao: uuid }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function SnapshotServico(props: { usuario: string; cliente: string; declaracao: string }) {
  if (import.meta.env.VITE_SSO_SNAPSHOT_SERVICO_MEDIADO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.declaracao])} {...props} />;
}

function Conteudo({ usuario, cliente, declaracao }: { usuario: string; cliente: string; declaracao: string }) {
  const chave = `snapshot-servico:${JSON.stringify([usuario, cliente, declaracao])}`;
  const cache = useQueryClient(); const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false); const [confirmado, setConfirmado] = useState(false); const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const raw = sessionStorage.getItem(chave); if (!raw) return null;
    const p = pedidoSchema.parse(JSON.parse(raw)); return p.cliente === cliente && p.declaracao === declaracao ? p : "invalido";
  } catch { return "invalido"; } });
  async function sessao(signal?: AbortSignal) {
    const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const consulta = useQuery({ queryKey: ["snapshot-servico", usuario, cliente, declaracao], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await sessao(signal);
      const { data, error } = await supabase.schema("financeiro").rpc("sso_consultar_snapshot_servico_mediado", { p_cliente_id: cliente, p_declaracao_id: declaracao }).abortSignal(signal);
      if (error) throw error; const itens = z.array(z.object({ snapshot_id: uuid, decisao_id: uuid }).strict()).max(1).parse(data);
      await sessao(signal); return itens[0] ?? null;
    } });
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setMensagem("");
    try {
      await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido alterado.");
      const { data, error } = await supabase.schema("financeiro").rpc("sso_registrar_snapshot_servico_mediado", {
        p_request_id: p.requestId, p_cliente_id: p.cliente, p_declaracao_id: p.declaracao,
      });
      if (error) throw error;
      const recibo = z.object({ requestId: uuid, estado: z.literal("snapshot_nao_faturavel"), geraFaturavel: z.literal(false) }).strict().parse(data);
      if (recibo.requestId !== p.requestId) throw new Error("Recibo divergente.");
      await sessao(); await cache.invalidateQueries({ queryKey: ["snapshot-servico", usuario, cliente, declaracao] }); await sessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido alterado.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmado(false); setMensagem("Fotografia registrada; nenhum faturável foi criado.");
    } catch { setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (!confirmado || pendente || ocupado || consulta.isFetching || consulta.isError || consulta.data !== null) return;
    try {
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), cliente, declaracao });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente.");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setMensagem("Não foi possível guardar o pedido; nada foi enviado."); }
  }
  return <section aria-label="Fotografia do serviço"><h5>Fotografia da decisão aceita</h5>
    <p>Registra a linha aprovada; não comprova execução nem gera faturável.</p>
    {consulta.isFetching && <output>Consultando fotografia…</output>}
    {consulta.isError && <p role="alert">Fotografia indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <p>Fotografia {consulta.data.snapshot_id} · decisão {consulta.data.decisao_id}.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data === null && <p>Nenhuma fotografia registrada.</p>}
    {pendente === "invalido" && <p role="alert">Pedido ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button> : !pendente && consulta.data === null && !consulta.isError && !consulta.isFetching && <>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} disabled={ocupado} /> Conferi a declaração e a decisão aceita.</label>
      <button type="button" disabled={!confirmado || ocupado} onClick={iniciar}>Registrar fotografia</button>
    </>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
