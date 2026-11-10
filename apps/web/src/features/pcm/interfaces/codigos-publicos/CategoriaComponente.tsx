import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const estadoSchema = z.object({ clienteId: z.string().guid(), componenteId: z.string().guid(), textoAtual: z.string().nullable(), categoriaId: z.string().guid().nullable(), revision: z.number().int().nonnegative(), atual: z.boolean() }).strict();
const categoriaSchema = z.object({ id: z.string().guid(), nome: z.string().min(1) }).strict();
const pedidoSchema = z.object({ requestId: z.string().guid(), clienteId: z.string().guid(), componenteId: z.string().guid(), categoriaId: z.string().guid(), textoObservado: z.string().nullable(), revision: z.number().int().nonnegative(), motivo: z.string().min(1).max(2000) }).strict();
const reciboSchema = pedidoSchema.omit({ textoObservado: true, motivo: true }).extend({ revision: z.number().int().positive() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; componenteId: string };

export function CategoriaComponente(props: Props) {
  if (import.meta.env.VITE_SSO_CATEGORIA_COMPONENTE_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.componenteId])} {...props} />;
}
function Conteudo({ userId, clienteId, componenteId }: Props) {
  const chave = `sso-categoria-componente:${JSON.stringify([userId, clienteId, componenteId])}`;
  const [categoriaId, setCategoriaId] = useState(""); const [motivo, setMotivo] = useState(""); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const valor = sessionStorage.getItem(chave); if (!valor) return null;
    const p = pedidoSchema.parse(JSON.parse(valor)); return p.clienteId === clienteId && p.componenteId === componenteId ? p : "invalido";
  } catch { return "invalido"; } });
  const client = useQueryClient(); const trava = useRef(false);
  const queryKey = ["categoria-componente", userId, clienteId, componenteId];
  async function conferir(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const estado = useQuery({ queryKey, gcTime: 0, queryFn: async ({ signal }) => {
    await conferir(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_categoria_componente", { p_ator_id: userId, p_cliente_id: clienteId, p_componente_id: componenteId }).abortSignal(signal);
    if (error) throw error; const r = estadoSchema.parse(data); if (r.clienteId !== clienteId || r.componenteId !== componenteId) throw new Error("Resposta divergente."); await conferir(signal); return r;
  } });
  const categorias = useInfiniteQuery({ queryKey: [...queryKey, "categorias"], gcTime: 0, initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
    await conferir(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_listar_categorias_mapeamento", { p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
    if (error) throw error; const pagina = z.array(categoriaSchema).max(30).parse(data); let anterior = pageParam?.toLowerCase() ?? null;
    for (const c of pagina) { const id = c.id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página inconsistente."); anterior = id; } await conferir(signal); return pagina;
  }, getNextPageParam: p => p.length === 30 ? p[p.length-1]?.id : undefined });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); await conferir();
    const { data, error } = await supabase.schema("pcm").rpc("sso_mapear_categoria_componente", { p_ator_id: userId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_componente_id: p.componenteId, p_categoria_id: p.categoriaId, p_texto_observado: p.textoObservado, p_revisao: p.revision, p_motivo: p.motivo });
    if (error) throw error; const r = reciboSchema.parse(data);
    if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.componenteId !== p.componenteId || r.categoriaId !== p.categoriaId || r.revision !== p.revision+1) throw new Error("Resposta divergente."); await conferir();
  }, onSuccess: async (_r,p) => { await client.invalidateQueries({ queryKey });
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); sessionStorage.removeItem(chave); }
    catch { setAviso("Mapeamento confirmado, mas tentativa não foi removida. Consulte suporte."); return; }
    setPendente(null); setCategoriaId(""); setMotivo(""); setAviso("Categoria vinculada. A fila Auvo não foi alterada.");
  }, onError: () => setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."), onSettled: () => { trava.current = false; } });
  const indisponivel = estado.isFetching || estado.isError || categorias.isFetching || categorias.isError;
  function enviar(p: Pedido) { if (trava.current || indisponivel) return; try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); } catch { setAviso("Tentativa indisponível. Consulte suporte."); return; } trava.current = true; setAviso(""); envio.mutate(p); }
  function iniciar() { if (indisponivel || !estado.data || pendente || trava.current || !categorias.data?.pages.flat().some(c => c.id === categoriaId)) return;
    try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, componenteId, categoriaId, textoObservado: estado.data.textoAtual, revision: estado.data.revision, motivo: motivo.trim() });
      if (sessionStorage.getItem(chave) !== null) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
    } catch { setAviso("Confira categoria, motivo e sessão. Nada foi enviado."); }
  }
  return <section aria-label="Categoria explícita do Componente"><h3>Categoria do Componente</h3>
    <p>O vínculo é confirmado manualmente e não muda a categoria textual nem a fila Auvo.</p>
    {(estado.isFetching || categorias.isFetching) && <output>Consultando classificação…</output>}
    {(estado.isError || categorias.isError) && <p role="alert">Classificação indisponível. <button type="button" onClick={() => { void estado.refetch(); void categorias.refetch(); }}>Tentar novamente</button></p>}
    {!indisponivel && estado.data && categorias.data && <><p>Categoria textual atual: {estado.data.textoAtual ?? "não informada"}. Mapeamento: {estado.data.categoriaId ? estado.data.atual ? "atual" : "desatualizado" : "não informado"}.</p>
      {pendente === "invalido" && <p role="alert">Tentativa ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" ? <p>Tentativa pendente para categoria {pendente.categoriaId}. <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa</button></p> : !pendente && <form onSubmit={e => { e.preventDefault(); iniciar(); }}><label>Categoria <select required value={categoriaId} onChange={e => setCategoriaId(e.target.value)}><option value="">Selecione</option>{categorias.data.pages.flat().map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>{categorias.hasNextPage && <button type="button" onClick={() => void categorias.fetchNextPage()}>Mais categorias</button>}<label>Motivo <textarea required maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label><button type="submit" disabled={envio.isPending}>Confirmar vínculo</button></form>}
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
