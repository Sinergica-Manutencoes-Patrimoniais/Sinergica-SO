import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const pedido = z.object({ atorId: z.string().uuid(), requestId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(),
  limiteMinutos: z.number().int().min(1).max(10080), motivo: z.string().trim().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedido>;
export function LimiteDemoraIntegracao({ userId }: { userId: string }) {
  const chave = `sso-config-limite-demora:${userId}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const texto = sessionStorage.getItem(chave); if (!texto) return null;
    const p = pedido.parse(JSON.parse(texto)); return p.atorId === userId ? p : "invalido"; } catch { return "invalido"; } });
  const [limite, setLimite] = useState(""); const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState(""); const trava = useRef(false); const cache = useQueryClient();
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  const consulta = useQuery({ queryKey: ["config-limite-demora", userId], gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    await conferirAtor(); const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_limite_demora", { p_ator_id: userId }).abortSignal(signal);
    if (error) throw error; const r = z.object({ revision: z.number().int().nonnegative(), limiteMinutos: z.number().int().min(1).max(10080).nullable(), observacaoAtivada: z.boolean() }).strict().parse(data);
    await conferirAtor(); if (signal.aborted) throw new Error("Consulta cancelada"); return r;
  } });
  const fotografia = JSON.stringify({ usuario: userId, configuracao: consulta.data, limite, motivo: motivo.trim() });
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try { await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_configurar_limite_demora", { p_ator_id: p.atorId, p_request_id: p.requestId,
        p_expected_revision: p.expectedRevision, p_limite_minutos: p.limiteMinutos, p_motivo: p.motivo }); if (error) throw error;
      const r = z.object({ requestId: z.string().uuid(), revision: z.number().int().positive(), limiteMinutos: z.number().int().min(1).max(10080),
        observacaoAtivada: z.boolean(), jobAlterado: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.revision !== p.expectedRevision + 1 || r.limiteMinutos !== p.limiteMinutos) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: ["config-limite-demora", userId] }); await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada"); sessionStorage.removeItem(chave); setPendente(null); setLimite(""); setMotivo(""); setConfirmacao(null);
      setAviso("Limite registrado. Nenhum job ou estado de ativação foi alterado.");
    } catch { setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); } finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() { if (trava.current || pendente || consulta.isFetching || consulta.isError || !consulta.data || confirmacao !== fotografia || !/^[1-9]\d{0,4}$/.test(limite)) return;
    try { const p = pedido.parse({ atorId: userId, requestId: crypto.randomUUID(), expectedRevision: consulta.data.revision, limiteMinutos: Number(limite), motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira limite e motivo. Nada foi enviado."); } }
  return <section aria-label="Limite de demora da integração"><h3>Limite de demora da integração</h3>
    <p>Configuração global em minutos. Alterar o limite não ativa observação nem agenda tarefas. Tempo excedido não comprova falha ou segurança de reenvio.</p>
    {consulta.isFetching && <p role="status">Consultando configuração…</p>}{consulta.isError && <p role="alert">Configuração indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <p>Limite atual: {consulta.data.limiteMinutos ?? "não configurado"} · observação {consulta.data.observacaoAtivada ? "ativada" : "desativada"} · revisão {consulta.data.revision}.</p>}
    {pendente === "invalido" ? <p role="alert">Tentativa inválida. Procure suporte.</p> : pendente ? <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button> :
      <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}><label>Novo limite em minutos <input type="number" min="1" max="10080" required value={limite} onChange={(e) => { setLimite(e.target.value); setConfirmacao(null); }} /></label>
        <label>Motivo <textarea required maxLength={1000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
        <label><input type="checkbox" checked={confirmacao === fotografia} disabled={ocupado || consulta.isFetching || consulta.isError || !consulta.data || !limite || !motivo.trim()} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi o limite global e a revisão.</label>
        <button type="submit" disabled={ocupado || consulta.isFetching || consulta.isError || !consulta.data || confirmacao !== fotografia}>Salvar limite</button></form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
