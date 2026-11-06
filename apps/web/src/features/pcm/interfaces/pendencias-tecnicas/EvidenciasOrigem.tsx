import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Props = { userId: string; clienteId: string; pendenciaId: string };
const item = z.object({ id: z.string().uuid(), revisao: z.number().int().positive(), mime_declarado: z.enum(["image/jpeg", "image/png"]), justificativa: z.string(), ator_id: z.string().uuid(), criado_em: z.string().datetime({ offset: true }) }).strict();
async function conferirSessao(userId: string, signal?: AbortSignal) { const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
export function EvidenciasOrigem(props: Props) {
  if (import.meta.env.VITE_SSO_EVIDENCIA_ORIGEM_PENDENCIA_ENABLED !== "true") return null;
  return <Abrir key={JSON.stringify([props.userId, props.clienteId, props.pendenciaId])} {...props} />;
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar evidências de origem" : "Ver evidências de origem"}</button>{aberto && <Conteudo {...props}/>}</section>;
}
function Conteudo({ userId, clienteId, pendenciaId }: Props) {
  const [baixando, setBaixando] = useState(false); const [aviso, setAviso] = useState("");
  const montado = useRef(false); useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const mediada = import.meta.env.VITE_SSO_EVIDENCIA_ORIGEM_MEDIADA_ENABLED === "true";
  const q = useInfiniteQuery({ queryKey: ["pendencia-evidencias-origem", userId, clienteId, pendenciaId], gcTime: 0, initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => { await conferirSessao(userId, signal); const parametros = { p_pendencia_id: pendenciaId, p_antes: pageParam, p_limite: 20 };
      const { data, error } = await (mediada ? supabase.schema("pcm").rpc("sso_listar_evidencias_origem_mediada", { ...parametros, p_ator_id: userId, p_cliente_id: clienteId }) : supabase.schema("pcm").rpc("sso_listar_evidencias_origem_pendencia", parametros)).abortSignal(signal);
      if (error) throw error; const pagina = z.array(item).max(20).parse(data); let anterior = pageParam ?? Number.POSITIVE_INFINITY;
      for (const registro of pagina) { if (registro.revisao >= anterior) throw new Error("Página divergente."); anterior = registro.revisao; }
      await conferirSessao(userId, signal); return pagina; },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.revisao : undefined });
  async function baixar(id: string) { if (baixando) return; setBaixando(true); setAviso(""); try {
    await conferirSessao(userId); if (!montado.current) throw new Error("Tela fechada.");
    const { data, error } = await supabase.functions.invoke<Blob>("pcm-evidencia-resposta-segura", { body: { lancamentoId: id } });
    if (error || !(data instanceof Blob)) throw new Error("Download indisponível");
    await conferirSessao(userId); if (!montado.current) throw new Error("Tela fechada.");
    const url = URL.createObjectURL(data); const link = document.createElement("a"); link.href = url; link.download = "evidencia-resposta"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { if (montado.current) setAviso("Não foi possível baixar a evidência. Verifique acesso e tente novamente."); } finally { if (montado.current) setBaixando(false); } }
  const evidencias = q.data?.pages.flat() ?? [];
  const divergentes = evidencias.some((e, i) => i > 0 && e.revisao >= evidencias[i - 1]!.revisao);
  return <section><h4>Evidências da resposta de origem</h4><p>O vínculo foi registrado na resposta, mas não comprova autoria, origem ou autenticidade do conteúdo. Ausência nesta fonte não prova ausência de outras evidências.</p>
    {q.isFetching && <output>Consultando…</output>}{q.isError && <p role="alert">Evidências indisponíveis. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching && !q.isError && divergentes && <p role="alert">Páginas de evidências divergentes. <button type="button" onClick={() => void q.refetch()}>Reconsultar</button></p>}
    {!q.isFetching && !q.isError && !divergentes && q.data && evidencias.length === 0 && <p>Nenhuma foto privada registrada nesta fonte.</p>}
    {!q.isFetching && !q.isError && !divergentes && q.data && <ul>{evidencias.map(e => <li key={e.id}>Revisão {e.revisao} · {e.mime_declarado} · {e.justificativa} · {e.ator_id} · <time dateTime={e.criado_em}>{new Date(e.criado_em).toLocaleString("pt-BR")}</time> <button type="button" disabled={baixando} onClick={() => void baixar(e.id)}>Baixar evidência</button><DecisaoFoto userId={userId} clienteId={clienteId} pendenciaId={pendenciaId} evidenciaId={e.id}/></li>)}</ul>}
    {!q.isFetching && !q.isError && !divergentes && q.hasNextPage && <button type="button" onClick={() => void q.fetchNextPage()}>Mais evidências</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
function DecisaoFoto(props: Props & { evidenciaId: string }) {
  const [aberto, setAberto] = useState(false);
  if (import.meta.env.VITE_SSO_DECISAO_FOTO_ORIGEM_ENABLED !== "true") return null;
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar decisão PCM" : "Ver última decisão PCM"}</button>{aberto && <DecisaoConteudo {...props}/>}</section>;
}
function DecisaoConteudo({ userId, clienteId, pendenciaId, evidenciaId }: Props & { evidenciaId: string }) {
  const schema = z.union([z.object({ evidenciaId: z.string().uuid(), decisao: z.null() }).strict(), z.object({ evidenciaId: z.string().uuid(), decisao: z.enum(["aceita_pcm", "rejeitada_pcm"]), revisao: z.number().int().positive(), justificativa: z.string(), atorId: z.string().uuid(), criadoEm: z.string().datetime({ offset: true }) }).strict()]);
  const q = useQuery({ queryKey: ["pendencia-decisao-foto", userId, clienteId, pendenciaId, evidenciaId], gcTime: 0, queryFn: async ({ signal }) => { await conferirSessao(userId, signal); const parametros = { p_pendencia_id: pendenciaId, p_evidencia_id: evidenciaId };
    const { data, error } = await (import.meta.env.VITE_SSO_EVIDENCIA_ORIGEM_MEDIADA_ENABLED === "true" ? supabase.schema("pcm").rpc("sso_decisao_foto_origem_mediada", { ...parametros, p_ator_id: userId, p_cliente_id: clienteId }) : supabase.schema("pcm").rpc("sso_decisao_foto_origem_pendencia", parametros)).abortSignal(signal); if (error) throw error; const r = schema.parse(data); if (r.evidenciaId !== evidenciaId) throw new Error("Evidência divergente"); await conferirSessao(userId, signal); return r; } });
  return <section><p>Decisão humana não comprova autenticidade ou segurança do conteúdo.</p>{q.isFetching && <output>Consultando decisão…</output>}{q.isError && <p role="alert">Decisão indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}{!q.isFetching && !q.isError && q.data && (q.data.decisao === null ? <p>Nenhuma decisão PCM registrada nesta fonte.</p> : <p>{q.data.decisao} · revisão {q.data.revisao} · {q.data.justificativa} · {q.data.atorId} · <time dateTime={q.data.criadoEm}>{new Date(q.data.criadoEm).toLocaleString("pt-BR")}</time></p>)}</section>;
}
