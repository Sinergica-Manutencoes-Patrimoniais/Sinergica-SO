import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { useState } from "react";
import { z } from "zod";
import { EventosOrigem } from "./EventosOrigem";
import { HistoricoObservacaoOrigem } from "./HistoricoObservacaoOrigem";
import { OrigensDespesaIncompletas } from "./OrigensDespesaIncompletas";
import { CustosProposta } from "./CustosProposta";

type Origem = { chave:string; descricao:string; classificacao:string; osId?: string };
const comercialSchema = z.object({ proposta_id: z.string().uuid(), os_id: z.string().uuid(), lista_id: z.string().uuid(),
  status: z.string(), versao: z.number().int().nullable(), classificacao: z.enum(["conflito_de_origem", "vinculo_observado"]) }).strict();
const financeiroSchema = z.object({ item_id: z.string().uuid(), despesa_id: z.string().uuid(), visita_id: z.string().uuid(),
  status: z.string(), revisao: z.number().int(), despesa_revisao_atual: z.number().int(), despesa_revisao_origem: z.number().int(),
  classificacao: z.enum(["conflito_de_origem", "despesa_alterada_conferir", "vinculo_observado"]) }).strict();
function Secao({userId,clienteId,tipo,onAbrirOs}:{userId:string;clienteId:string;tipo:"comercial" | "financeiro";onAbrirOs?: (osId:string) => void}) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [observacaoSelecionada, setObservacaoSelecionada] = useState<string | null>(null);
  const consulta=useInfiniteQuery({queryKey:["reconciliacao-origens",userId,clienteId,tipo],gcTime:0,initialPageParam:null as string | null,
    queryFn:async ({pageParam,signal}) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const mediada=import.meta.env.VITE_SSO_ORIGENS_INTERNAS_MEDIADAS_ENABLED === "true";
      const nome=tipo === "comercial" ? (mediada ? "sso_reconciliacao_comercial_mediada" : "sso_listar_reconciliacao_comercial") : (mediada ? "sso_reconciliacao_financeiro_mediada" : "sso_listar_reconciliacao_financeiro");
      const {data,error}=await supabase.schema("pcm").rpc(nome,{p_cliente_id:clienteId,p_apos:pageParam,p_limite:50,...(mediada?{p_ator_id:userId}:{})}).abortSignal(signal);
      if(error) throw error;
      const pagina: Origem[] = tipo === "comercial"
        ? z.array(comercialSchema).max(50).parse(data).map((r) => ({chave:r.proposta_id, osId:r.os_id, classificacao:r.classificacao,
          descricao:`Proposta ${r.proposta_id} · OS ${r.os_id} · lista ${r.lista_id} · ${r.status} · versão ${r.versao ?? "não informada"}`}))
        : z.array(financeiroSchema).max(50).parse(data).map((r) => ({chave:r.item_id, classificacao:r.classificacao,
          descricao:`Item ${r.item_id} · despesa ${r.despesa_id} · visita ${r.visita_id} · ${r.status} · revisão ${r.revisao} · despesa: revisão de origem ${r.despesa_revisao_origem}, atual ${r.despesa_revisao_atual}`}));
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const origem of pagina) {
        const chave = origem.chave.toLowerCase();
        if (anterior !== null && chave <= anterior) throw new Error("Página de origens divergente.");
        anterior = chave;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },getNextPageParam:(pagina) => pagina.length===50 ? pagina.at(-1)?.chave : undefined});
  const origens=consulta.data?.pages.flat()??[];const divergentes=origens.some((item,i)=>i>0&&item.chave.toLowerCase()<=origens[i-1]!.chave.toLowerCase());
  return <section aria-label={`Origens ${tipo}`}><h4>{tipo === "comercial" ? "Comercial" : "Financeiro"}</h4>
    {consulta.isFetching && <output>Carregando origens…</output>}
    {consulta.isError && <p role="alert">Consulta indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && divergentes && <p role="alert">As páginas de origens divergiram. <button type="button" onClick={()=>void consulta.refetch()}>Reconsultar</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && !divergentes && origens.length === 0 && <p>Nenhum vínculo encontrado nesta consulta.</p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && !divergentes && <ul>{origens.map((r) => <li key={r.chave}>{r.descricao} · {r.classificacao}
      {r.osId && onAbrirOs && <button type="button" onClick={() => onAbrirOs(r.osId!)}>Abrir OS</button>}
      {tipo === "comercial" && import.meta.env.VITE_SSO_CUSTOS_PROPOSTA_ESCOPADOS_ENABLED === "true" && <CustosProposta userId={userId} clienteId={clienteId} propostaId={r.chave} />}
      {import.meta.env.VITE_SSO_EVENTOS_RECONCILIACAO_ENABLED === "true" && <button type="button" onClick={() => setSelecionado(selecionado === r.chave ? null : r.chave)}>Eventos locais</button>}
      {selecionado === r.chave && import.meta.env.VITE_SSO_EVENTOS_RECONCILIACAO_ENABLED === "true" && <EventosOrigem userId={userId} clienteId={clienteId} tipo={tipo} id={r.chave} />}
      {import.meta.env.VITE_SSO_HISTORICO_ORIGENS_ENABLED === "true" && <><button type="button" aria-expanded={observacaoSelecionada === r.chave} onClick={() => setObservacaoSelecionada(observacaoSelecionada === r.chave ? null : r.chave)}>Observações locais</button>
        {observacaoSelecionada === r.chave && <HistoricoObservacaoOrigem userId={userId} clienteId={clienteId} tipo={tipo} objetoId={r.chave} />}</>}
    </li>)}</ul>}
    {consulta.hasNextPage && !consulta.isError && !divergentes && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais origens</button>}
  </section>;
}
export function OrigensInternas({userId,clienteId,onAbrirOs}:{userId:string;clienteId:string;onAbrirOs?: (osId:string) => void}) {
  return <section aria-label="Origens Comercial e Financeiro"><h3>Vínculos internos</h3>
    <p>Somente vínculos comprovados. Observação não é confirmação ou resolução de divergência. Valores omitidos.</p>
    <Secao key={JSON.stringify([userId,clienteId,"comercial"])} userId={userId} clienteId={clienteId} tipo="comercial" onAbrirOs={onAbrirOs}/><Secao key={JSON.stringify([userId,clienteId,"financeiro"])} userId={userId} clienteId={clienteId} tipo="financeiro"/>
    {import.meta.env.VITE_SSO_ORIGENS_DESPESA_INCOMPLETAS_ENABLED === "true" && <OrigensDespesaIncompletas userId={userId} clienteId={clienteId} />}
  </section>;
}
