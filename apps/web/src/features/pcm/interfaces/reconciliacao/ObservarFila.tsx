import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id=z.string().guid();
const pedidoSchema=z.object({requestId:id,atorId:id,clienteId:id,outboxId:id}).strict();
type Pedido=z.infer<typeof pedidoSchema>;
const reciboSchema=z.object({requestId:id,clienteId:id,efeitoRemotoComprovado:z.literal(false),itens:z.array(z.object({
  outboxId:id,revisao:z.number().int().positive(),estado:z.enum(["pendente","incerto","enviado_nao_confirmado"]),
  estadoFonte:z.enum(["pending","processing","error","sent"]),tentativas:z.number().int().nonnegative().safe(),
}).strict()).length(1)}).strict();
const eventoSchema=z.object({revisao:z.number().int().positive(),request_id:id,ator_id:id.nullable(),estado:z.enum(["pendente","incerto","enviado_nao_confirmado"]),
  estado_fonte:z.enum(["pending","processing","error","sent"]),tentativas:z.number().int().nonnegative().safe(),criado_em:z.string().datetime({offset:true})}).strict();

export function ObservarFila({userId,clienteId,outboxId}:{userId:string;clienteId:string;outboxId:string}){
  const chave=`sso-observacao-fila:${JSON.stringify([userId,clienteId,outboxId])}`;const trava=useRef(false);const cache=useQueryClient();
  const [ocupado,setOcupado]=useState(false);const [aviso,setAviso]=useState("");
  const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const texto=sessionStorage.getItem(chave);if(!texto)return null;const p=pedidoSchema.parse(JSON.parse(texto));return p.atorId===userId&&p.clienteId===clienteId&&p.outboxId===outboxId?p:"invalido";}catch{return "invalido";}});
  const historico=useInfiniteQuery({queryKey:["reconciliacao-observacoes",userId,clienteId,outboxId],gcTime:0,retry:false,initialPageParam:null as number|null,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_listar_observacoes_fila",{p_ator_id:userId,p_cliente_id:clienteId,p_outbox_id:outboxId,p_apos_revision:pageParam,p_limite:20}).abortSignal(signal);
      if(error)throw error;const pagina=z.array(eventoSchema).max(20).parse(data);let anterior=pageParam??0;for(const e of pagina){
        const esperado=e.estado_fonte==="pending"?"pendente":e.estado_fonte==="sent"?"enviado_nao_confirmado":"incerto";
        if(e.revisao<=anterior||e.estado!==esperado)throw new Error("Histórico divergente.");anterior=e.revisao;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(p)=>p.length===20?p.at(-1)?.revisao:undefined});
  async function enviar(p:Pedido){if(trava.current)return;try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();}catch{setAviso("Pedido alterado. Procure suporte.");return;}
    trava.current=true;setOcupado(true);setAviso("");try{
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_observar_fila_reconciliacao",{p_ator_id:userId,p_cliente_id:clienteId,p_request_id:p.requestId,p_outbox_ids:[p.outboxId]});
      if(error)throw error;const r=reciboSchema.parse(data);const item=r.itens[0];
      if(r.requestId!==p.requestId||r.clienteId!==clienteId||!item||item.outboxId!==outboxId||item.estado!==(item.estadoFonte==="pending"?"pendente":item.estadoFonte==="sent"?"enviado_nao_confirmado":"incerto"))throw new Error("Recibo divergente.");
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");
      await Promise.all([cache.invalidateQueries({queryKey:["reconciliacao-outbox",userId,clienteId]}),cache.invalidateQueries({queryKey:["reconciliacao-observacoes",userId,clienteId,outboxId]})]);
      const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido alterado.");
      sessionStorage.removeItem(chave);setPendente(null);setAviso(`Observação registrada: ${item.estado}, revisão ${item.revisao}. Resultado remoto continua desconhecido.`);
    }catch{setAviso("Resultado não confirmado. Preserve e repita o mesmo pedido ou procure suporte.");}finally{trava.current=false;setOcupado(false);}}
  function iniciar(){if(pendente||trava.current)return;try{const p=pedidoSchema.parse({requestId:crypto.randomUUID(),atorId:userId,clienteId,outboxId});if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);void enviar(p);}catch{setAviso("Não foi possível guardar a tentativa; nada foi enviado.");}}
  return <section aria-label="Observação local da fila"><p>Registra o estado local atual sem repetir envio, confirmar efeito remoto ou resolver a integração.</p>
    {pendente==="invalido"?<p role="alert">Pedido ilegível; procure suporte.</p>:pendente?<button type="button" disabled={ocupado} onClick={()=>void enviar(pendente)}>Repetir observação</button>:<button type="button" disabled={ocupado} onClick={iniciar}>Registrar observação local</button>}
    {aviso&&<p role="status">{aviso}</p>}
    <h5>Histórico de observações locais</h5><p>Os registros mostram o que foi observado naquele momento; não comprovam efeito remoto ou situação atual.</p>
    {historico.isFetching&&<output>Consultando histórico…</output>}
    {historico.isError&&<p role="alert">Histórico indisponível. <button type="button" onClick={()=>void historico.refetch()}>Tentar novamente</button></p>}
    {!historico.isFetching&&!historico.isError&&historico.data&&<>{historico.data.pages.flat().length===0?<p>Nenhuma observação registrada.</p>:<ol>{historico.data.pages.flat().map((e)=><li key={e.revisao}>Revisão {e.revisao} · {e.estado} · fila {e.estado_fonte} · {e.tentativas} tentativa(s) · {e.ator_id ? `responsável ${e.ator_id}` : "varredura automática"} · {new Date(e.criado_em).toLocaleString("pt-BR")}</li>)}</ol>}{historico.hasNextPage&&<button type="button" onClick={()=>void historico.fetchNextPage()}>Mais observações</button>}</>}
  </section>;
}
