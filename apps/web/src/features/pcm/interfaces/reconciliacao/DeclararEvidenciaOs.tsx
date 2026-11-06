import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), osId: z.string().uuid(), atualizadoEm: z.string(), sync: z.string().nullable(), taskId: z.string().nullable(), nota: z.string().min(1).max(1000), resultado: z.enum(["nenhum", "um", "multiplos", "desconhecido"]), origem: z.string().min(1).max(200), referencia: z.string().min(1).max(300) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; osId: string; atualizadoEm: string; sync: string | null; taskId: string | null; bloqueado: boolean };
export function DeclararEvidenciaOs({ userId, clienteId, osId, atualizadoEm, sync, taskId, bloqueado }: Props) {
  const chave = `sso-evidencia-os:${JSON.stringify([userId, clienteId, osId])}`;
  const [resultado, setResultado] = useState<Pedido["resultado"]>("desconhecido");
  const [origem, setOrigem] = useState("");
  const [referencia, setReferencia] = useState("");
  const [nota, setNota] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = pedidoSchema.parse(JSON.parse(salvo)); return p.clienteId === clienteId && p.osId === osId ? p : "invalido"; } catch { return "invalido"; }
  });
  const ocupado = useRef(false);
  const cache = useQueryClient();
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_declarar_evidencia_os_manual", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_os_id: p.osId, p_updated_at: p.atualizadoEm, p_sync: p.sync, p_task_id: p.taskId, p_nota: p.nota, p_resultado: p.resultado, p_origem: p.origem, p_referencia: p.referencia });
    if (error) throw error;
    const resposta = z.object({ requestId: z.string().uuid(), osId: z.string().uuid(), estado: z.literal("declaracao_nao_verificada"), autorizaRetry: z.literal(false) }).strict().parse(data);
    if (resposta.requestId !== p.requestId || resposta.osId !== p.osId) throw new Error("Resposta divergente");
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
  } });
  const enviar = async (p: Pedido) => {
    if (ocupado.current || bloqueado) return;
    ocupado.current = true;
    try {
      await envio.mutateAsync(p);
      await Promise.all([cache.invalidateQueries({ queryKey: ["reconciliacao-os-evidencias", userId, clienteId, osId] }), cache.invalidateQueries({ queryKey: ["reconciliacao-os-notas", userId, clienteId, osId] }), cache.invalidateQueries({ queryKey: ["reconciliacao-os-revalidacao", userId, clienteId, osId] })]);
      await cache.invalidateQueries({ queryKey: ["inbox-os-incerta", userId, clienteId] });
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave); setPedido(null); setNota(""); setOrigem(""); setReferencia("");
      setMensagem("Declaração registrada sem verificação remota. Nenhuma ação Auvo foi realizada.");
    } catch { setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte; não crie outro enquanto houver dúvida."); }
    finally { ocupado.current = false; }
  };
  return <section aria-label="Declarar evidência manual"><h4>Declarar evidência manual</h4>
    <p>Declaração não verificada; não vincula tarefa nem autoriza retentativa no Auvo. Não informe credenciais ou dados sensíveis.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (pedido || bloqueado || ocupado.current) return;
      const candidato = pedidoSchema.safeParse({ requestId: crypto.randomUUID(), clienteId, osId, atualizadoEm, sync, taskId, nota: nota.trim(), resultado, origem: origem.trim(), referencia: referencia.trim() });
      if (!candidato.success) { setMensagem("Preencha resultado, origem, referência e justificativa."); return; }
      try { if (sessionStorage.getItem(chave)) { setMensagem("Existe pedido anterior; reabra para recuperá-lo."); return; } sessionStorage.setItem(chave, JSON.stringify(candidato.data)); }
      catch { setMensagem("Não foi possível preservar o pedido; nada foi enviado."); return; }
      setPedido(candidato.data); void enviar(candidato.data);
    }}>
      <label>Resultado declarado <select value={resultado} disabled={!!pedido || envio.isPending} onChange={(e) => setResultado(e.target.value as Pedido["resultado"])}><option value="desconhecido">Desconhecido</option><option value="nenhum">Nenhum candidato</option><option value="um">Um candidato</option><option value="multiplos">Múltiplos candidatos</option></select></label>{" "}
      <label>Origem <input required maxLength={200} value={origem} disabled={!!pedido || envio.isPending} onChange={(e) => setOrigem(e.target.value)} /></label>{" "}
      <label>Referência <input required maxLength={300} value={referencia} disabled={!!pedido || envio.isPending} onChange={(e) => setReferencia(e.target.value)} /></label>{" "}
      <label>Justificativa <textarea required maxLength={1000} value={nota} disabled={!!pedido || envio.isPending} onChange={(e) => setNota(e.target.value)} /></label>{" "}
      <button type="submit" disabled={!!pedido || bloqueado || envio.isPending}>Registrar declaração</button>
    </form>
    {pedido === "invalido" && <p role="alert">Pedido guardado ilegível. Procure suporte.</p>}
    {pedido && pedido !== "invalido" && <button type="button" disabled={bloqueado || envio.isPending} onClick={() => void enviar(pedido)}>Repetir mesmo registro local</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
