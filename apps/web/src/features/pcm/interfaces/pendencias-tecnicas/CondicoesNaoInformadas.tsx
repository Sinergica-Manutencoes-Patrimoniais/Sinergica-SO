import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Alvo = { alvo_tipo: string; alvo_id: string; alvo_nome: string | null };
type Props = { userId: string; clienteId: string; alvos: Alvo[] };
const linha = z.object({ pendencia_id: z.string().uuid(), alvo_tipo: z.string(), alvo_id: z.string().uuid(), pergunta: z.string(), revisao: z.number().int().positive(), situacao_contexto: z.enum(["sem_contexto_registrado", "condicao_nao_informada"]) }).strict();
export function CondicoesNaoInformadas(props: Props) {
  if (import.meta.env.VITE_SSO_CONDICAO_NAO_INFORMADA_ENABLED !== "true") return null;
  return <Abrir key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar condições não informadas" : "Consultar condições não informadas"}</button>{aberto && <Conteudo {...props}/>}</section>;
}
function Conteudo({ userId, clienteId, alvos }: Props) {
  const [filtro, setFiltro] = useState("");
  const unicos = Array.from(new Map(alvos.map(a => [JSON.stringify([a.alvo_tipo, a.alvo_id]), a])).entries());
  const alvo = unicos.find(([chave]) => chave === filtro)?.[1];
  const q = useInfiniteQuery({ queryKey: ["pendencias-sem-condicao", userId, clienteId, alvo?.alvo_tipo ?? null, alvo?.alvo_id ?? null], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_listar_pendencias_sem_condicao", { p_cliente_id: clienteId, p_alvo_tipo: alvo?.alvo_tipo ?? null, p_alvo_id: alvo?.alvo_id ?? null, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; return z.array(linha).max(20).parse(data); },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.pendencia_id : undefined });
  return <section><h3>Condições técnicas não informadas</h3><p>Sem condição não significa ausência de falha, norma ou risco. Opções de alvo vêm das Pendências carregadas; sem filtro, a consulta abrange o Cliente.</p>
    <label>Alvo <select value={alvo ? filtro : ""} onChange={e => setFiltro(e.target.value)}><option value="">Todos do Cliente</option>{unicos.map(([chave, a]) => <option key={chave} value={chave}>{a.alvo_tipo} · {a.alvo_nome ?? a.alvo_id}</option>)}</select></label>
    {q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {q.data && q.data.pages.flat().length === 0 && <p>Nenhuma Pendência aberta sem condição nesta consulta.</p>}
    {q.data && <ul>{q.data.pages.flat().map(p => <li key={p.pendencia_id}>{p.pergunta} · {p.alvo_tipo} {p.alvo_id} · revisão {p.revisao} · {p.situacao_contexto === "sem_contexto_registrado" ? "sem contexto registrado" : "condição não informada na última revisão"}</li>)}</ul>}
    {q.hasNextPage && <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Mais Pendências</button>}
  </section>;
}
