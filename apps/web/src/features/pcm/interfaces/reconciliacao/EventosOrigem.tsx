import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const comercial = z.object({ versao: z.number().int(), sequencia: z.number().int(), acao: z.enum(["retirar", "republicar"]), criado_em: z.string() }).strict();
const financeiro = z.object({ revisao: z.number().int(), tipo: z.enum(["conferido", "cancelado"]), ocorrido_em: z.string() }).strict();
type Evento = { cursor: { versao: number; sequencia: number } | number; descricao: string };
export function EventosOrigem({ userId, clienteId, tipo, id }: { userId: string; clienteId: string; tipo: "comercial" | "financeiro"; id: string }) {
  const consulta = useInfiniteQuery({ queryKey: ["reconciliacao-eventos-origem", userId, clienteId, tipo, id], gcTime: 0,
    initialPageParam: null as Evento["cursor"] | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const mediada=import.meta.env.VITE_SSO_EVENTOS_ORIGENS_MEDIADOS_ENABLED === "true";
      if (tipo === "comercial") {
        const cursor = typeof pageParam === "object" ? pageParam : null;
        const { data, error } = await supabase.schema("pcm").rpc(mediada ? "sso_eventos_comercial_mediados" : "sso_eventos_reconciliacao_comercial", { p_cliente_id: clienteId, p_proposta_id: id, p_versao: cursor?.versao ?? null, p_sequencia: cursor?.sequencia ?? null, p_limite: 50, ...(mediada?{p_ator_id:userId}:{}) }).abortSignal(signal);
        if (error) throw error;
        const pagina=z.array(comercial).max(50).parse(data);let anterior=cursor;
        for(const e of pagina){if(e.versao<1||e.sequencia<1||(anterior&&(e.versao<anterior.versao||(e.versao===anterior.versao&&e.sequencia<=anterior.sequencia))))throw new Error("Página divergente.");anterior={versao:e.versao,sequencia:e.sequencia};}
        const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
        return pagina.map((e): Evento => ({ cursor: { versao: e.versao, sequencia: e.sequencia }, descricao: `Versão ${e.versao}, ${e.acao}, ${e.criado_em}` }));
      }
      const { data, error } = await supabase.schema("pcm").rpc(mediada ? "sso_eventos_financeiro_mediados" : "sso_eventos_reconciliacao_financeiro", { p_cliente_id: clienteId, p_item_id: id, p_apos: typeof pageParam === "number" ? pageParam : null, p_limite: 50, ...(mediada?{p_ator_id:userId}:{}) }).abortSignal(signal);
      if (error) throw error;
      const pagina=z.array(financeiro).max(50).parse(data);let anterior=typeof pageParam === "number" ? pageParam : 0;
      for(const e of pagina){if(e.revisao<=anterior)throw new Error("Página divergente.");anterior=e.revisao;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return pagina.map((e): Evento => ({ cursor: e.revisao, descricao: `Revisão ${e.revisao}, ${e.tipo}, ${e.ocorrido_em}` }));
    }, getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.cursor : undefined });
  const eventos=consulta.data?.pages.flat()??[];
  const divergentes=eventos.some((e,i)=>{if(i===0)return false;const anterior=eventos[i-1]!.cursor,atual=e.cursor;
    if(typeof atual === "number" && typeof anterior === "number")return atual<=anterior;
    if(typeof atual === "object" && typeof anterior === "object")return atual.versao<anterior.versao||(atual.versao===anterior.versao&&atual.sequencia<=anterior.sequencia);
    return true;});
  return <section aria-label="Eventos da origem"><p>Eventos locais selecionados; não representam histórico completo nem comprovam estado remoto.</p>
    {consulta.isFetching && <output>Carregando eventos...</output>}
    {consulta.isError && <p role="alert">Eventos indisponíveis ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && divergentes && <p role="alert">Páginas divergentes. <button type="button" onClick={()=>void consulta.refetch()}>Reconsultar</button></p>}
    {!consulta.isFetching && !consulta.isError && !divergentes && consulta.data && eventos.length===0 && <p>Nenhum evento nesta fonte.</p>}
    {!consulta.isFetching && !consulta.isError && !divergentes && <ul>{eventos.map((e) => <li key={JSON.stringify(e.cursor)}>{e.descricao}</li>)}</ul>}
    {consulta.hasNextPage && !divergentes && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais eventos</button>}
  </section>;
}
