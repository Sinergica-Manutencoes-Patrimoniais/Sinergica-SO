import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const evento = z.object({ revisao_publicacao: z.number().int().positive(), sequencia: z.number().int().positive(), acao: z.enum(["retirar", "republicar"]), motivo: z.string(), ator_id: z.string().uuid(), criado_em: z.string() }).strict();
const pedido = z.object({ requestId: z.string().uuid(), listaId: z.string().uuid(), revisao: z.number().int().positive(), acao: z.enum(["retirar", "republicar"]), motivo: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedido>;
export function VisibilidadePortal(props: { usuario: string; cliente: string; listaId: string }) {
  if (import.meta.env.VITE_SSO_VISIBILIDADE_MATERIAIS_ENABLED !== "true" || import.meta.env.VITE_SSO_VISIBILIDADE_MATERIAIS_MEDIADA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.listaId])} {...props} />;
}
function Conteudo({ usuario, cliente, listaId }: { usuario: string; cliente: string; listaId: string }) {
  const chave = `sso-visibilidade-material:${JSON.stringify([usuario, cliente, listaId])}`; const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.listaId === listaId ? p : "invalido"; } catch { return "invalido"; } });
  const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aberto, setAberto] = useState(false); const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const raiz = ["visibilidade-material", usuario, cliente, listaId];
  async function sessao(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada."); }
  const status = useQuery({ queryKey: [...raiz, "status"], gcTime: 0, staleTime: 0, retry: false, queryFn: async ({ signal }) => {
    await sessao(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_status_material_mediado", { p_ator_id: usuario, p_cliente_id: cliente, p_lista_id: listaId }).abortSignal(signal);
    if (error) throw error; const resultado = z.array(z.object({ revisao_publicacao: z.number().int().positive(), situacao: z.enum(["publicar", "retirar", "republicar"]), aplicavel: z.boolean() }).strict()).max(1).parse(data)[0] ?? null; await sessao(signal); return resultado;
  } });
  const historico = useInfiniteQuery({ queryKey: [...raiz, "historico", status.data?.revisao_publicacao ?? null], enabled: aberto && !status.isFetching && !status.isError && !!status.data, gcTime: 0, staleTime: 0, retry: false, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => { await sessao(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_historico_material_mediado", { p_ator_id: usuario, p_cliente_id: cliente, p_lista_id: listaId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; const linhas = z.array(evento).max(20).parse(data); let anterior = pageParam; for (const linha of linhas) { if (linha.sequencia <= anterior || linha.revisao_publicacao !== status.data?.revisao_publicacao) throw new Error("Página divergente."); anterior = linha.sequencia; } await sessao(signal); return linhas; }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.sequencia : undefined });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente."); const { data, error } = await supabase.schema("pcm").rpc("sso_visibilidade_material_mediada", {
    p_ator_id: usuario, p_cliente_id: cliente, p_request_id: p.requestId, p_lista_id: p.listaId, p_revisao_publicacao: p.revisao, p_acao: p.acao, p_motivo: p.motivo });
    if (error) throw error; const resultado = z.number().int().positive().parse(data); await sessao(); return resultado;
  }, onSuccess: async (_r, p) => { try { await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setConfirmacao(null); setMotivo(""); setAviso("Visibilidade atualizada."); await cache.invalidateQueries({ queryKey: raiz });
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  const fotografia = JSON.stringify([usuario, cliente, listaId, status.data, motivo.trim()]);
  function iniciar() { if (pendente || enviando.current || status.isFetching || status.isError || !status.data?.aplicavel || confirmacao !== fotografia) return; try {
    const p = pedido.parse({ requestId: crypto.randomUUID(), listaId, revisao: status.data.revisao_publicacao,
      acao: status.data.situacao === "retirar" ? "republicar" : "retirar", motivo: motivo.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira motivo e sessão. Nada foi enviado."); } }
  return <section><h5>Visibilidade da lista pública</h5><p>Republicação usa exatamente o texto publicado anteriormente; alterações exigem nova revisão.</p>
    {status.isFetching && <p>Consultando publicação…</p>}{status.isError && <p role="alert">Publicação indisponível. <button type="button" onClick={() => void status.refetch()}>Tentar novamente</button></p>}
    {!status.isFetching && !status.isError && status.data === null && <p>Nenhuma publicação registrada.</p>}
    {!status.isFetching && !status.isError && status.data && <p>Revisão pública {status.data.revisao_publicacao} · {status.data.situacao === "retirar" ? "retirada" : "publicada"}{!status.data.aplicavel && " · conteúdo desatualizado"}</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button> :
      !pendente && status.data?.aplicavel && !status.isFetching && !status.isError && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Motivo <input required maxLength={1000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
        <label><input type="checkbox" checked={confirmacao === fotografia} disabled={!motivo.trim() || comando.isPending} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi a versão, a ação e o motivo.</label>
        <button type="submit" disabled={comando.isPending || confirmacao !== fotografia}>{status.data.situacao === "retirar" ? "Republicar" : "Retirar"}</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}<button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar histórico" : "Ver histórico"}</button>
    {aberto && historico.isFetching && <p>Consultando histórico…</p>}{aberto && historico.isError && <p role="alert">Histórico indisponível.</p>}
    {aberto && !status.isFetching && !status.isError && !historico.isFetching && !historico.isError && historico.data?.pages.flat().map((e) => <p key={e.sequencia}>{e.acao} · {new Date(e.criado_em).toLocaleString("pt-BR")} · {e.ator_id} · {e.motivo}</p>)}
    {aberto && !historico.isFetching && !historico.isError && historico.hasNextPage && <button type="button" onClick={() => void historico.fetchNextPage()}>Mais eventos</button>}
  </section>;
}
