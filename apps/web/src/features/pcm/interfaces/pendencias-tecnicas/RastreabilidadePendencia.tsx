import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; pendenciaId: string };
const origem = z.object({ pendenciaId: z.string().guid(), respostaId: z.string().guid(), retornoId: z.string().guid(), osOrigemId: z.string().guid(), ocorrenciaId: z.string().guid().nullable(), ocorrenciaGrupoId: z.string().guid().nullable().optional(), tipoOrigem: z.enum(["legada", "grupo"]).optional(), rotinaId: z.string().guid(), alvoTipo: z.string(), alvoId: z.string().guid() }).strict().refine((r) => r.tipoOrigem === "grupo" ? r.ocorrenciaId === null && !!r.ocorrenciaGrupoId : !!r.ocorrenciaId && !r.ocorrenciaGrupoId);
const vinculo = z.object({ composicao_id: z.string().guid(), chamado_id: z.string().guid().nullable(), parcela_id: z.string().guid().nullable(), os_atribuida_id: z.string().guid().nullable() }).strict();
export function RastreabilidadePendencia(props: Props) {
  if (import.meta.env.VITE_SSO_RASTREABILIDADE_PENDENCIA_ENABLED !== "true") return null;
  return <Abrir key={JSON.stringify([props.userId, props.clienteId, props.pendenciaId])} {...props} />;
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar rastreabilidade" : "Ver rastreabilidade"}</button>{aberto && <Conteudo {...props}/>}</section>;
}
function Conteudo({ userId, clienteId, pendenciaId }: Props) {
  const conferirSessao = async (signal: AbortSignal) => { const atual=await supabase.auth.getUser(); if(atual.error||atual.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada."); };
  const fonte = useQuery({ queryKey: ["pendencia-rastreabilidade", userId, clienteId, pendenciaId, "origem"], gcTime: 0, queryFn: async ({ signal }) => {
    await conferirSessao(signal);
    const { data, error } = await supabase.schema("pcm").rpc(import.meta.env.VITE_SSO_PENDENCIA_ORIGEM_GRUPO_ENABLED === "true" ? "sso_origem_pendencia_v2" : "sso_origem_pendencia", { p_pendencia_id: pendenciaId }).abortSignal(signal); if (error) throw error;
    const r = origem.parse(data); if (r.pendenciaId !== pendenciaId) throw new Error("Pendência divergente"); await conferirSessao(signal); return r;
  }});
  const lista = useInfiniteQuery({ queryKey: ["pendencia-rastreabilidade", userId, clienteId, pendenciaId, "vinculos"], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { await conferirSessao(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_vinculos_pendencia", { p_pendencia_id: pendenciaId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error;
      const pagina=z.array(vinculo).max(20).parse(data);let anterior=pageParam?.toLowerCase() ?? "";
      for(const item of pagina){const atual=item.composicao_id.toLowerCase();if(atual<=anterior)throw new Error("Página divergente.");anterior=atual;}
      await conferirSessao(signal);return pagina; },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.composicao_id : undefined });
  return <section><h4>Rastreabilidade</h4><p>Fonte parcial: somente vínculos atualmente registrados. Ausência não comprova inexistência histórica; atribuição de OS não comprova execução.</p>
    {fonte.isFetching && <output>Consultando origem…</output>}{fonte.isError && <p role="alert">Origem indisponível. <button type="button" onClick={() => void fonte.refetch()}>Tentar novamente</button></p>}
    {!fonte.isFetching && !fonte.isError && fonte.data && <p>Resposta {fonte.data.respostaId} · retorno {fonte.data.retornoId} · OS de origem {fonte.data.osOrigemId} · {fonte.data.tipoOrigem === "grupo" ? `ocorrência Grupo ${fonte.data.ocorrenciaGrupoId}` : `ocorrência legada ${fonte.data.ocorrenciaId}`} · rotina {fonte.data.rotinaId} · {fonte.data.alvoTipo} {fonte.data.alvoId}</p>}
    {lista.isFetching && <output>Consultando vínculos…</output>}{lista.isError && <p role="alert">Vínculos indisponíveis. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isFetching && !lista.isError && lista.data && lista.data.pages.flat().length === 0 && <p>Nenhuma composição ativa nesta fonte.</p>}
    {!lista.isFetching && !lista.isError && lista.data && <ul>{lista.data.pages.flat().map(v => <li key={v.composicao_id}>Composição {v.composicao_id} · {v.chamado_id ? `Chamado ${v.chamado_id}` : "Chamado não vinculado nesta fonte"} · {v.parcela_id ? `parcela ${v.parcela_id}` : "parcela não vinculada nesta fonte"} · {v.os_atribuida_id ? `OS atribuída ${v.os_atribuida_id}` : "OS atribuída não encontrada nesta fonte"}</li>)}</ul>}
    {!lista.isFetching && !lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais vínculos</button>}
  </section>;
}
