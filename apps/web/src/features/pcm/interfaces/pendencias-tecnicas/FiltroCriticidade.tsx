import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ pendencia_id: z.string().uuid(), alvo_tipo: z.string(), alvo_id: z.string().uuid(), pergunta: z.string(), revisao: z.number().int().positive(), criticidade: z.string().nullable(), situacao_criticidade: z.enum(["informada", "nao_informada"]) }).strict();
type Props = { userId: string; clienteId: string };
export function FiltroCriticidade(props: Props) {
  if (import.meta.env.VITE_SSO_FILTRO_CRITICIDADE_ENABLED !== "true") return null;
  return <Abrir key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar filtro de criticidade" : "Filtrar por criticidade"}</button>{aberto && <Conteudo {...props}/>}</section>;
}
function Conteudo({ userId, clienteId }: Props) {
  const [filtro, setFiltro] = useState<"todas" | "informada" | "nao_informada">("todas");
  const [texto, setTexto] = useState(""); const [valor, setValor] = useState("");
  const q = useInfiniteQuery({ queryKey: ["pendencias-filtro-criticidade", userId, clienteId, filtro, valor], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_filtrar_criticidade_pendencias", { p_cliente_id: clienteId, p_filtro: filtro, p_valor: filtro === "informada" && valor ? valor : null, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; return z.array(linha).max(20).parse(data); },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.pendencia_id : undefined });
  return <section><h3>Criticidade declarada</h3><p>Texto registrado não é ranking. Criticidade não informada não significa prioridade baixa.</p>
    <label>Filtro <select value={filtro} onChange={e => { setFiltro(e.target.value as typeof filtro); setValor(""); setTexto(""); }}><option value="todas">Todas</option><option value="informada">Informada</option><option value="nao_informada">Não informada</option></select></label>
    {filtro === "informada" && <form onSubmit={e => { e.preventDefault(); setValor(texto.trim()); }}><label>Texto exato opcional <input maxLength={100} value={texto} onChange={e => setTexto(e.target.value)} /></label><button type="submit">Aplicar</button></form>}
    {q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {q.data && q.data.pages.flat().length === 0 && <p>Nenhuma Pendência aberta neste filtro.</p>}
    {q.data && <ul>{q.data.pages.flat().map(p => <li key={p.pendencia_id}>{p.pergunta} · {p.alvo_tipo} {p.alvo_id} · revisão {p.revisao} · {p.situacao_criticidade === "informada" ? `declarada: ${p.criticidade}` : "criticidade não informada"}</li>)}</ul>}
    {q.hasNextPage && <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Mais Pendências</button>}
  </section>;
}
