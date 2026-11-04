import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z.object({ requestId: z.string().uuid(), pendenciaId: z.string().uuid(), revisao: z.number().int().positive(), alvo: z.string().min(1).max(200), descricao: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function PublicarPendenciaPortal({ userId, clienteId, pendenciaId, revisao }: { userId: string; clienteId: string; pendenciaId: string; revisao: number }) {
  const chave = `sso-publicar-pendencia:${JSON.stringify([userId, clienteId, pendenciaId, revisao])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const texto = sessionStorage.getItem(chave); if (!texto) return null;
    const pedido = pedidoSchema.parse(JSON.parse(texto));
    return pedido.pendenciaId === pendenciaId && pedido.revisao === revisao ? pedido : "invalido";
  } catch { return "invalido"; } });
  const [alvo, setAlvo] = useState(""); const [descricao, setDescricao] = useState(""); const [aviso, setAviso] = useState("");
  const enviando = useRef(false); const cache = useQueryClient();
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const fotografia = JSON.stringify([userId, clienteId, pendenciaId, revisao, alvo.trim(), descricao.trim()]);
  async function conferirSessao() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId) throw new Error("Sessão alterada."); }
  const publicacao = useMutation({ mutationFn: async (pedido: Pedido) => {
    await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_publicar_pendencia_portal_mediada", { p_ator_id: userId, p_cliente_id: clienteId, p_request_id: pedido.requestId,
      p_pendencia_id: pedido.pendenciaId, p_revisao: pedido.revisao, p_alvo: pedido.alvo, p_descricao: pedido.descricao });
    if (error) throw error; const id = z.string().uuid().parse(data); await conferirSessao(); return id;
  }, onSuccess: async (_id, pedido) => {
    try { await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas a tentativa local não foi limpa. Consulte o histórico."); return; }
    setPendente(null); setAlvo(""); setDescricao(""); setConfirmacao(null); setAviso("Pedido registrado. Confira o histórico: uma repetição não restaura publicação revogada.");
    await cache.invalidateQueries({ queryKey: ["pcm-publicacoes-pendencia", userId, clienteId, pendenciaId] });
  }, onError: () => setAviso("Resultado não confirmado. Repita o mesmo pedido ou consulte o histórico."),
  onSettled: () => { enviando.current = false; } });
  function enviar(pedido: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); publicacao.mutate(pedido); }
  function iniciar() { if (pendente || enviando.current || confirmacao !== fotografia) return; try {
    const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), pendenciaId, revisao, alvo: alvo.trim(), descricao: descricao.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente");
    sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); enviar(pedido);
  } catch { setAviso("Confira os dados e a sessão. Nada foi enviado."); } }
  return <section><p>Confira o conteúdo para o Cliente; observações e evidências internas não são publicadas automaticamente.</p>
    {pendente === "invalido" && <p role="alert">Pedido local ilegível. Consulte suporte e o histórico.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={publicacao.isPending} onClick={() => enviar(pendente)}>Repetir pedido de publicação</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Identificação pública do ativo <input required maxLength={200} value={alvo} disabled={publicacao.isPending} onChange={(e) => setAlvo(e.target.value)} /></label>
        <label>Descrição pública <textarea required maxLength={1000} value={descricao} disabled={publicacao.isPending} onChange={(e) => setDescricao(e.target.value)} /></label>
        <label><input type="checkbox" checked={confirmacao === fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi o texto público e o Cliente.</label>
        <button type="submit" disabled={publicacao.isPending || !alvo.trim() || !descricao.trim() || confirmacao !== fotografia}>Publicar pendência</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
