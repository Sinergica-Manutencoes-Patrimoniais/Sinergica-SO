import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../lib/supabase-client";
import { conferirSessaoProposta, validarDecisaoPropostaOs, type DecidirPropostaOs } from "../infrastructure/supabase-portal-propostas-os-adapter";

type Tentativa={chave:string;texto:string;pedido:DecidirPropostaOs};
export function RecuperarDecisoesProposta(props:{userId:string;clienteId:string;osId:string}){
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.osId])} {...props}/>;
}
function Conteudo({userId,clienteId,osId}:{userId:string;clienteId:string;osId:string}){
  const prefixo=`sso-portal-proposta:${userId}:${clienteId}:${osId}:`;const tentativas:Tentativa[]=[];let invalida=false;
  const [mensagem,setMensagem]=useState("");const [,atualizar]=useState(0);const trava=useRef(false);const cache=useQueryClient();
  try{for(let i=0;i<sessionStorage.length;i++){const chave=sessionStorage.key(i);if(!chave?.startsWith(prefixo))continue;
    try{const texto=sessionStorage.getItem(chave);if(!texto||texto.length>10000)throw new Error();const pedido=validarDecisaoPropostaOs(JSON.parse(texto));
      if(chave!==`${prefixo}${pedido.propostaId}`)throw new Error();tentativas.push({chave,texto,pedido});}catch{invalida=true;}}
  }catch{invalida=true;}
  const consulta=useMutation({mutationFn:async(t:Tentativa)=>{await conferirSessaoProposta(userId);if(sessionStorage.getItem(t.chave)!==t.texto)throw new Error("Tentativa alterada.");const p=t.pedido;
    const {data,error}=await supabase.schema("comercial").rpc("sso_portal_recibo_decisao_proposta",{p_ator_id:userId,p_cliente_id:clienteId,p_os_id:osId,p_request_id:p.requestId,p_proposta_id:p.propostaId,p_versao:p.versao,p_decisao:p.decisao,p_motivo:p.motivo});
    if(error||!data||data.requestId!==p.requestId||data.aggregateId!==p.propostaId||data.revision!==p.versao||data.state!==p.decisao)throw new Error("Recibo indisponível.");await conferirSessaoProposta(userId);
  },onSuccess:async(_resultado,t)=>{try{await cache.invalidateQueries({queryKey:["portal-propostas-os",userId,clienteId,osId],refetchType:"none"});await conferirSessaoProposta(userId);
    if(sessionStorage.getItem(t.chave)!==t.texto)throw new Error();sessionStorage.removeItem(t.chave);atualizar(n=>n+1);setMensagem("Decisão confirmada. Esta consulta não cria cobrança ou nova decisão.");
    void cache.refetchQueries({queryKey:["portal-propostas-os",userId,clienteId,osId],type:"active"});
  }catch{setMensagem("Recibo encontrado, mas a tentativa não foi removida. Procure suporte.");}},onError:()=>setMensagem("Não foi possível confirmar a decisão. A tentativa foi preservada; procure suporte."),onSettled:()=>{trava.current=false;}});
  if(!tentativas.length&&!invalida&&!mensagem)return null;
  return <section aria-label="Recuperar decisão de orçamento"><h4>Decisões pendentes nesta aba</h4><p>Consultar recibo não envia uma nova decisão.</p>
    {invalida&&<p role="alert">Tentativa ilegível. Procure suporte.</p>}
    <ul>{tentativas.map(t=><li key={t.chave}>Proposta {t.pedido.propostaId} · versão {t.pedido.versao} · {t.pedido.decisao} <button type="button" disabled={consulta.isPending} onClick={()=>{if(trava.current)return;trava.current=true;consulta.mutate(t);}}>Consultar recibo</button></li>)}</ul>
    {mensagem&&<p role="status">{mensagem}</p>}
  </section>;
}
