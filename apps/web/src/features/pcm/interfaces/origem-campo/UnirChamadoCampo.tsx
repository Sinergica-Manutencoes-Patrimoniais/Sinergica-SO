import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
export const pedidoUniaoChamadoCampoSchema = z.object({ requestId: uuid, clienteId: uuid, osId: uuid, origemId: uuid, destinoId: uuid,
  origemRevision: z.number().int().positive().safe(), destinoRevision: z.number().int().positive().safe(),
  osUpdatedAt: z.string().datetime({ offset: true }).nullable(), taskId: z.string().regex(/^[1-9]\d{0,18}$/),
  acao: z.enum(["unir", "duplicidade"]), motivo: z.string().min(1).max(2000) }).strict();
const pedidoSchema = pedidoUniaoChamadoCampoSchema;
type Pedido = z.infer<typeof pedidoSchema>;
const destinoSchema = z.object({ chamado_id: uuid, numero: z.string(), titulo: z.string(), revisao: z.number().int().positive().safe() }).strict();
type Props = { userId: string; clienteId: string; osId: string; origemId: string; origemRevision: number; osUpdatedAt: string | null; taskId: string | null; disponivel: boolean };

export function UnirChamadoCampo(props: Props) {
  if (import.meta.env.VITE_SSO_UNIAO_CHAMADO_CAMPO_ENABLED !== "true") return null;
  return <Conteudo key={`${props.userId}:${props.clienteId}:${props.osId}`} {...props} />;
}
function Conteudo({ userId, clienteId, osId, origemId, origemRevision, osUpdatedAt, taskId, disponivel }: Props) {
  const chave = `sso-uniao-chamado-campo:${JSON.stringify([userId, clienteId, osId])}`;
  const outrasChaves = ["sso-triagem-chamado-campo:", "sso-cancelamento-chamado-campo:"].map((prefixo) => `${prefixo}${JSON.stringify([userId, clienteId, osId])}`);
  const [destinoId, setDestinoId] = useState(""); const [acao, setAcao] = useState<"unir" | "duplicidade">("unir");
  const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const trava = useRef(false); const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw));
    return p.clienteId === clienteId && p.osId === osId && p.origemId === origemId ? p : "invalido"; } catch { return "invalido"; } });
  async function conferirSessao(signal?: AbortSignal) { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const destinos = useInfiniteQuery({ queryKey: ["destinos-chamado-campo", userId, clienteId, osId], gcTime: 0, refetchOnWindowFocus: true,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_listar_destinos_chamado_campo", { p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error; const itens = z.array(destinoSchema).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of itens) { const id = item.chamado_id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página divergente."); anterior = id; }
      await conferirSessao(signal); return itens;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.chamado_id : undefined });
  const selecionado = !destinos.isFetching && !destinos.isError ? destinos.data?.pages.flat().find((d) => d.chamado_id === destinoId) : undefined;
  const foto = JSON.stringify([userId, clienteId, osId, origemId, origemRevision, osUpdatedAt, taskId, selecionado ?? null, acao, motivo.trim()]);
  const confirmado = confirmacao === foto;
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_unir_chamado_campo", { p_ator_id: userId, p_cliente_id: p.clienteId, p_request_id: p.requestId,
      p_os_id: p.osId, p_origem_id: p.origemId, p_destino_id: p.destinoId, p_origem_revision: p.origemRevision, p_destino_revision: p.destinoRevision,
      p_os_updated_at: p.osUpdatedAt, p_task_id: p.taskId, p_acao: p.acao, p_motivo: p.motivo });
    if (error) throw error;
    const r = z.object({ requestId: uuid, clienteId: uuid, origemId: uuid, destinoId: uuid, osId: uuid,
      origemRevision: z.number().int().positive().safe(), destinoRevision: z.number().int().positive().safe(), acao: z.enum(["unir", "duplicidade"]),
      numeroOs: z.string().min(1), taskId: z.string(), tarefaAlterada: z.literal(false), execucaoAlterada: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.origemId !== p.origemId || r.destinoId !== p.destinoId || r.osId !== p.osId || r.taskId !== p.taskId || r.acao !== p.acao) throw new Error("Recibo divergente.");
    await conferirSessao(); return r;
  }, onSuccess: async (_r, p) => {
    try { await cache.invalidateQueries({ queryKey: ["estado-origem-campo", userId, clienteId], refetchType: "none" }); await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null);
      setAviso("Vínculo transferido. OS, número e tarefa foram preservados; o Chamado de origem foi cancelado.");
      void cache.refetchQueries({ queryKey: ["estado-origem-campo", userId, clienteId], type: "active" });
    } catch { setAviso("Não foi possível confirmar sessão ou tentativa. Consulte suporte."); }
  }, onError: () => setAviso("Resultado não confirmado. Preserve e repita o mesmo pedido ou consulte suporte."), onSettled: () => { trava.current = false; } });
  function executar(p: Pedido) { if (trava.current) return; try { if (sessionStorage.getItem(chave) !== JSON.stringify(p) || outrasChaves.some((k) => sessionStorage.getItem(k) !== null)) throw new Error(); } catch { setAviso("Há outra tentativa pendente ou divergente. Reconcilie antes de continuar."); return; } trava.current = true; envio.mutate(p); }
  function iniciar() {
    if (!disponivel || !confirmado || !selecionado || !taskId || pendente || trava.current || destinos.isFetching || destinos.isError) return;
    try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, osId, origemId, destinoId: selecionado.chamado_id,
      origemRevision, destinoRevision: selecionado.revisao, osUpdatedAt, taskId, acao, motivo: motivo.trim() });
      if (sessionStorage.getItem(chave) || outrasChaves.some((k) => sessionStorage.getItem(k) !== null)) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); executar(p);
    } catch { setAviso("Confira destino, motivo e armazenamento. Nada foi enviado."); }
  }
  return <section aria-label="Unir Chamado de campo">
    <h5>Unir ou marcar duplicidade</h5>
    <p>A OS será vinculada ao destino e o Chamado provisório será cancelado com histórico; tarefa e execução não serão canceladas. Origem com outras OS ou escopo exige reconciliação.</p>
    {destinos.isFetching && <output>Consultando destinos…</output>}{destinos.isError && <p role="alert">Destinos indisponíveis. <button type="button" onClick={() => void destinos.refetch()}>Tentar novamente</button></p>}
    {pendente === "invalido" ? <p role="alert">Tentativa local inválida. Consulte suporte.</p> : pendente ? <button type="button" disabled={envio.isPending} onClick={() => executar(pendente)}>Repetir mesmo pedido</button> : <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
      <label>Chamado de destino <select value={destinoId} onChange={(e) => { setDestinoId(e.target.value); setConfirmacao(null); }}><option value="">Selecione</option>{!destinos.isFetching && !destinos.isError && destinos.data?.pages.flat().map((d) => <option key={d.chamado_id} value={d.chamado_id}>{d.numero} · {d.titulo}</option>)}</select></label>
      <label>Ação <select value={acao} onChange={(e) => { setAcao(e.target.value as typeof acao); setConfirmacao(null); }}><option value="unir">Unir</option><option value="duplicidade">Marcar duplicidade</option></select></label>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} /> Conferi origem, destino, tarefa e motivo.</label>
      <button type="submit" disabled={!disponivel || !selecionado || !taskId || !confirmado || envio.isPending}>Confirmar transferência</button>
    </form>}
    {destinos.hasNextPage && !destinos.isError && <button type="button" disabled={destinos.isFetching} onClick={() => void destinos.fetchNextPage()}>Mais destinos</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
