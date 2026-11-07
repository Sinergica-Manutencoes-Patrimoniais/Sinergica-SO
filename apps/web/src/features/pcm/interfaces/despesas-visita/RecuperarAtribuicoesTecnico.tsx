import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { esquemaAtribuicaoTecnico } from "./AtribuirTecnico";

type Tentativa={chave:string;texto:string;pedido:z.infer<typeof esquemaAtribuicaoTecnico>};
export function RecuperarAtribuicoesTecnico(props:{userId:string;clienteId:string;visitaId:string}){
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.visitaId])} {...props}/>;
}
function Conteudo({userId,clienteId,visitaId}:{userId:string;clienteId:string;visitaId:string}){
  const [mensagem,setMensagem]=useState("");const [,atualizar]=useState(0);const trava=useRef(false);const cache=useQueryClient();
  const prefixo=`sso-tecnico-despesa:${userId}:${clienteId}:${visitaId}:`;const tentativas:Tentativa[]=[];let invalida=false;
  try{for(let i=0;i<sessionStorage.length;i++){const chave=sessionStorage.key(i);if(!chave?.startsWith(prefixo))continue;
    try{const texto=sessionStorage.getItem(chave);if(!texto||texto.length>10000)throw new Error();const p=esquemaAtribuicaoTecnico.parse(JSON.parse(texto));
      if(p.visitaId!==visitaId||chave!==`${prefixo}${p.despesaId}`)throw new Error();tentativas.push({chave,texto,pedido:p});}catch{invalida=true;}}
  }catch{invalida=true;}
  async function conferir(){const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId)throw new Error("Sessão alterada.");}
  const consulta=useMutation({mutationFn:async(t:Tentativa)=>{await conferir();if(sessionStorage.getItem(t.chave)!==t.texto)throw new Error("Tentativa alterada.");const p=t.pedido;
    const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_recibo_tecnico_despesa",{p_ator_id:userId,p_cliente_id:clienteId,p_visita_id:visitaId,p_request_id:p.requestId,p_despesa_id:p.despesaId,p_expected_revision:p.expectedRevision,p_participacao_id:p.participacaoId,p_motivo:p.motivo});
    if(error||!data||data.aggregateId!==p.despesaId||data.revision!==p.expectedRevision+1||data.requestId!==p.requestId||data.linkedIds?.visitaId!==visitaId)throw new Error("Recibo indisponível.");await conferir();
  },onSuccess:async(_resultado,t)=>{try{await cache.invalidateQueries({queryKey:["despesas-visita",userId,clienteId,visitaId]});await cache.invalidateQueries({queryKey:["relatorio-despesas-cliente",userId,clienteId]});
    await conferir();if(sessionStorage.getItem(t.chave)!==t.texto)throw new Error();sessionStorage.removeItem(t.chave);atualizar(n=>n+1);setMensagem("Atribuição confirmada no histórico local; não comprova execução ou pagamento.");
  }catch{setMensagem("Recibo confirmado, mas tentativa não removida. Confira a sessão e procure suporte.");}},onError:()=>setMensagem("Recibo indisponível. A tentativa foi preservada; procure suporte."),onSettled:()=>{trava.current=false;}});
  if(!tentativas.length&&!invalida&&!mensagem)return null;
  return <section aria-label="Recuperar atribuições de técnico"><h5>Recuperar atribuições de técnico</h5><p>A consulta não altera a despesa nem confirma execução ou pagamento.</p>
    {invalida&&<p role="alert">Há tentativa local ilegível. Procure suporte.</p>}
    <ul>{tentativas.map(t=><li key={t.chave}>Despesa {t.pedido.despesaId} · revisão solicitada {t.pedido.expectedRevision} <button type="button" disabled={consulta.isPending} onClick={()=>{if(trava.current)return;trava.current=true;consulta.mutate(t);}}>Consultar recibo</button></li>)}</ul>
    {mensagem&&<p role="status">{mensagem}</p>}
  </section>;
}
