import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
const pedidoSchema = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), composicaoId: z.string().uuid(), revisao: z.number().int().positive(), chamadoId: z.string().uuid(), titulo: z.string().min(1).max(200), descricao: z.string().max(10000), total: z.number().int().min(1).max(100).optional() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function PromoverComposicao({ userId, clienteId, composicaoId, revisao, total }: { userId: string; clienteId: string; composicaoId: string; revisao: number; total: number }) {
  const cache = useQueryClient(); const chave = `promocao-backlog:${JSON.stringify([userId, clienteId, composicaoId])}`; const trava = useRef(false);
  const [titulo, setTitulo] = useState(""); const [descricao, setDescricao] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const fotografia = JSON.stringify([userId, clienteId, composicaoId, revisao, total, titulo.trim(), descricao.trim()]);
  const confirmado = confirmacao === fotografia;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.clienteId === clienteId && p.composicaoId === composicaoId ? p : "invalido"; } catch { return "invalido"; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Sessão ou tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_promover_backlog_chamado", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_composicao_id: p.composicaoId, p_expected_revision: p.revisao, p_chamado_id: p.chamadoId, p_titulo: p.titulo, p_descricao: p.descricao });
    if (error) throw error;
    const r = z.object({ requestId: z.string().uuid(), composicaoId: z.string().uuid(), chamadoId: z.string().uuid(), numero: z.string(), parcelas: z.array(z.object({ pendenciaId: z.string().uuid(), parcelaId: z.string().uuid() }).strict()).min(1).max(100), osCriada: z.literal(false), promocaoIntegral: z.literal(true) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.composicaoId !== p.composicaoId || r.chamadoId !== p.chamadoId ||
      new Set(r.parcelas.map((item) => item.pendenciaId.toLowerCase())).size !== r.parcelas.length ||
      new Set(r.parcelas.map((item) => item.parcelaId.toLowerCase())).size !== r.parcelas.length ||
      (p.total !== undefined && r.parcelas.length !== p.total)) throw new Error("Resposta divergente.");
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    return r;
  }, onSuccess: async (r, p) => {
    await Promise.all([cache.invalidateQueries({ queryKey: ["backlog-composicoes", userId, clienteId] }), cache.invalidateQueries({ queryKey: ["backlog-vinculo", userId, clienteId, composicaoId] }), cache.invalidateQueries({ queryKey: ["backlog-composicao-direta", userId, clienteId, composicaoId] })]);
    try {
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
      sessionStorage.removeItem(chave);
    } catch { setAviso("Promoção confirmada, mas tentativa local não foi removida. Procure suporte."); return; }
    setPendente(null); setConfirmacao(null); setAviso(`Chamado ${r.numero} criado com composição integral; nenhuma OS foi criada.`);
  }, onError: () => setAviso("Resultado não confirmado ou revisão alterada. Repita a mesma tentativa ou procure suporte."), onSettled: () => { trava.current = false; } });
  const enviar = (p: Pedido) => { if (trava.current) return; trava.current = true; envio.mutate(p); };
  const iniciar = () => { if (pendente || trava.current || !confirmado) return; try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, composicaoId, revisao, chamadoId: crypto.randomUUID(), titulo: titulo.trim(), descricao: descricao.trim(), total }); if (sessionStorage.getItem(chave) !== null) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p); } catch { setAviso("Confira título, revisão e sessão. Nada foi enviado."); } };
  return <section aria-label="Promover composição integral"><h4>Promover composição ao Chamado</h4><p>Promove integralmente as {total} Pendência(s) desta composição, preservando as fontes. Seleção parcial não é suportada; nenhuma OS ou tarefa Auvo será criada.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Procure suporte.</p>}{pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa de promoção</button> : !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}><label>Título <input required maxLength={200} value={titulo} onChange={(e) => { setTitulo(e.target.value); setConfirmacao(null); }} /></label><label>Descrição <textarea maxLength={10000} value={descricao} onChange={(e) => { setDescricao(e.target.value); setConfirmacao(null); }} /></label><p>Revisão da composição: {revisao}.</p><label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Confirmo promoção integral da composição</label><button type="submit" disabled={!confirmado || envio.isPending || total < 1 || total > 100}>Criar Chamado</button></form>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
