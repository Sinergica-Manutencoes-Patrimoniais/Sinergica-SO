import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function GutdParcela({userId,clienteId,parcelaId}:{userId:string;clienteId:string;parcelaId:string}){
  const ativo=import.meta.env.VITE_SSO_GUTD_PARCELA_ENABLED==="true";
  const q=useQuery({queryKey:["pendencias-tecnicas",userId,clienteId,parcelaId,"gutd-composicao"],enabled:ativo,gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_gutd_parcela",{p_parcela_id:parcelaId}).abortSignal(signal);if(error)throw error;const fator=z.number().int().min(1).max(5).nullable();const r=z.object({parcelaId:z.string().uuid(),composicaoId:z.string().uuid(),revision:z.number().int().positive(),g:fator,u:fator,t:fator,d:fator,estado:z.enum(["fatores_ausentes","pesos_indisponiveis","pesos_insuficientes","dor_nao_informada","completa"]),score:z.number().nullable()}).strict().parse(data);if(r.parcelaId!==parcelaId)throw new Error("Parcela divergente");return r;}});
  if(!ativo)return null;
  if(q.isPending)return <p>Consultando GUTD da composição…</p>;
  if(q.isError)return <p role="alert">GUTD indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>;
  return <p>GUTD da composição vinculada: G {q.data.g ?? "—"}, U {q.data.u ?? "—"}, T {q.data.t ?? "—"}, D {q.data.d ?? "não informada"}; {q.data.score === null ? "pontuação indisponível" : `pontuação ${q.data.score.toFixed(2)}`} ({q.data.estado}). Não é classificação individual da parcela nem posição fixa na fila.</p>;
}
