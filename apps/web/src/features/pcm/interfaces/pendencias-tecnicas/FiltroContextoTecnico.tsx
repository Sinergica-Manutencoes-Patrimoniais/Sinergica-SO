import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Props = { userId: string; clienteId: string };
type Filtro = "todas" | "informada" | "nao_informada";
const linha = z.object({ pendencia_id: z.string().guid(), alvo_tipo: z.string(), alvo_id: z.string().guid(), pergunta: z.string(), revisao: z.number().int().positive(), norma: z.string().nullable(), condicao_informada: z.boolean(), contexto_registrado: z.boolean() }).strict();
export function FiltroContextoTecnico(props: Props) {
  if (import.meta.env.VITE_SSO_FILTRO_CONTEXTO_TECNICO_ENABLED !== "true") return null;
  return <Abrir key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar filtro de contexto" : "Filtrar contexto técnico"}</button>{aberto && <Conteudo {...props}/>}</section>;
}
function Conteudo({ userId, clienteId }: Props) {
  const [norma, setNorma] = useState<Filtro>("todas"); const [condicao, setCondicao] = useState<Filtro>("todas");
  const [texto, setTexto] = useState(""); const [valor, setValor] = useState("");
  const q = useInfiniteQuery({ queryKey: ["pendencias-filtro-contexto", userId, clienteId, norma, condicao, valor], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_filtrar_contexto_pendencias", { p_cliente_id: clienteId, p_norma_filtro: norma, p_condicao_filtro: condicao, p_norma_valor: norma === "informada" && valor ? valor : null, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; return z.array(linha).max(20).parse(data); },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.pendencia_id : undefined });
  return <section><h3>Norma e condição declaradas</h3><p>Registro de norma não comprova conformidade; ausência não comprova inaplicabilidade.</p>
    <label>Norma <select value={norma} onChange={e => { setNorma(e.target.value as Filtro); setValor(""); setTexto(""); }}><option value="todas">Todas</option><option value="informada">Informada</option><option value="nao_informada">Não informada</option></select></label>
    <label>Condição <select value={condicao} onChange={e => setCondicao(e.target.value as Filtro)}><option value="todas">Todas</option><option value="informada">Informada</option><option value="nao_informada">Não informada</option></select></label>
    {norma === "informada" && <form onSubmit={e => { e.preventDefault(); setValor(texto.trim()); }}><label>Norma exata opcional <input maxLength={500} value={texto} onChange={e => setTexto(e.target.value)}/></label><button type="submit">Aplicar</button></form>}
    {q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {q.data && q.data.pages.flat().length === 0 && <p>Nenhuma Pendência aberta neste filtro.</p>}
    {q.data && <ul>{q.data.pages.flat().map(p => <li key={p.pendencia_id}>{p.pergunta} · {p.alvo_tipo} {p.alvo_id} · revisão {p.revisao} · {p.contexto_registrado ? "contexto registrado" : "sem contexto registrado"} · {p.norma ? `norma: ${p.norma}` : "norma não informada"} · {p.condicao_informada ? "condição informada" : "condição não informada"}</li>)}</ul>}
    {q.hasNextPage && <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Mais Pendências</button>}
  </section>;
}
