import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function ResumoFotosLote({userId,clienteId,loteId}:{userId:string;clienteId:string;loteId:string}){
  const ativo=import.meta.env.VITE_SSO_RESUMO_FOTOS_LOTE_ENABLED==="true";
  const q=useQuery({queryKey:["levantamentos",userId,clienteId,loteId,"resumo-fotos"],enabled:ativo,gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_resumo_fotos_autorizado",{p_lote_id:loteId}).abortSignal(signal);if(error)throw error;const r=z.object({loteId:z.string().uuid(),total:z.number().int().nonnegative(),semDecisao:z.number().int().nonnegative(),aceitas:z.number().int().nonnegative(),rejeitadas:z.number().int().nonnegative()}).strict().parse(data);if(r.loteId!==loteId || r.semDecisao+r.aceitas+r.rejeitadas!==r.total)throw new Error("Resumo divergente");return r;}});
  if(!ativo)return null;
  if(q.isPending)return <p>Consultando fotos do lote…</p>;
  if(q.isError)return <p role="alert">Resumo de fotos indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>;
  return <p>Fotos: {q.data.total} · sem decisão: {q.data.semDecisao} · aceitas: {q.data.aceitas} · rejeitadas: {q.data.rejeitadas}. Resumo informativo; decisão da foto não publica arquivo nem bloqueia aprovação do lote.</p>;
}
