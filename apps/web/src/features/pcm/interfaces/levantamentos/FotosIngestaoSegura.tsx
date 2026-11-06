import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props={userId:string;clienteId:string;loteId:string;chave:string;aoConfirmar?:()=>void;aoCancelar?:()=>void};
const pedido=z.object({requestId:z.string().uuid(),userId:z.string(),clienteId:z.string().uuid(),loteId:z.string().uuid(),chave:z.string().min(1).max(200),hash:z.string().regex(/^[a-f0-9]{64}$/),tipo:z.enum(["image/jpeg","image/png"])}).strict();
type Pedido=z.infer<typeof pedido>;
const consultaSchema=z.object({requestId:z.string().uuid(),confirmada:z.boolean(),observacao:z.object({observadoEm:z.string(),objetoCatalogado:z.boolean(),confirmada:z.boolean()}).strict().nullable()}).strict();
export function FotosIngestaoSegura(p:Props){if(import.meta.env.VITE_SSO_FOTO_INGESTAO_SEGURA_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([p.userId,p.clienteId,p.loteId,p.chave])} {...p}/>;}
function Conteudo({userId,clienteId,loteId,chave,aoConfirmar,aoCancelar}:Props){
 const storageKey=`sso-foto-digest:${JSON.stringify([userId,clienteId,loteId,chave])}`;
 const cancelKey=`${storageKey}:cancelamento`;
 const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const raw=sessionStorage.getItem(storageKey);if(!raw)return null;const p=pedido.parse(JSON.parse(raw));return p.userId===userId&&p.clienteId===clienteId&&p.loteId===loteId&&p.chave===chave?p:"invalido";}catch{return "invalido";}});
 const [arquivo,setArquivo]=useState<File|null>(null);const [aviso,setAviso]=useState("");const [ocupado,setOcupado]=useState(false);const trava=useRef(false);
 const [conferencia,setConferencia]=useState<z.infer<typeof consultaSchema>|null>(null);
 const [requestInformado,setRequestInformado]=useState("");
 const [motivo,setMotivo]=useState("");const [ciente,setCiente]=useState(false);
 const [cancelamento,setCancelamento]=useState<{requestId:string;motivo:string}|"invalido"|null>(()=>{try{const raw=sessionStorage.getItem(cancelKey);if(!raw)return null;return z.object({requestId:z.string().uuid(),motivo:z.string().min(1).max(2000)}).strict().parse(JSON.parse(raw));}catch{return "invalido";}});
 const montado=useRef(false);useEffect(()=>{montado.current=true;return()=>{montado.current=false;};},[]);
 async function enviar(){if(!arquivo||trava.current||pendente==="invalido"||cancelamento)return;trava.current=true;setOcupado(true);setAviso("");
  try{
   if(!["image/jpeg","image/png"].includes(arquivo.type)||arquivo.size===0||arquivo.size>10485760)throw new Error("arquivo_invalido");
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await arquivo.arrayBuffer())),v=>v.toString(16).padStart(2,"0")).join("");
   const p=pendente??pedido.parse({requestId:crypto.randomUUID(),userId,clienteId,loteId,chave,hash,tipo:arquivo.type});
   if(p.hash!==hash||p.tipo!==arquivo.type)throw new Error("arquivo_divergente");
   if(!pendente){if(sessionStorage.getItem(storageKey)!==null)throw new Error("tentativa_existente");sessionStorage.setItem(storageKey,JSON.stringify(p));setPendente(p);}
   if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("tentativa_alterada");
   const identidade=await supabase.auth.getUser();if(identidade.error||identidade.data.user?.id!==userId)throw new Error("sessao_alterada");
   if(!montado.current||sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("tentativa_alterada");
   const {data,error}=await supabase.functions.invoke("pcm-foto-ingestao-segura",{body:arquivo,headers:{"content-type":p.tipo,"x-request-id":p.requestId,"x-lote-id":p.loteId,"x-linha-chave":p.chave}});if(error)throw error;
   const resposta=z.object({fotoId:z.string().uuid(),requestId:z.string().uuid()}).strict().parse(data);if(resposta.requestId!==p.requestId)throw new Error("resposta_divergente");
   const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||!montado.current)throw new Error("sessao_alterada");
   if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("tentativa_alterada");
   sessionStorage.removeItem(storageKey);setPendente(null);setArquivo(null);setAviso("Foto recebida no levantamento; não publicada no cadastro oficial.");aoConfirmar?.();
  }catch{if(montado.current)setAviso("Resultado não confirmado. Repita com o mesmo arquivo; se continuar pendente, consulte suporte.");}finally{trava.current=false;if(montado.current)setOcupado(false);}
 }
 async function consultar(){const requestId=pendente&&pendente!=="invalido"?pendente.requestId:requestInformado.trim();if(!z.string().uuid().safeParse(requestId).success||trava.current)return;trava.current=true;setOcupado(true);setConferencia(null);
  try{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId)throw new Error("sessao_alterada");
   const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_observacao_ingestao_foto",{p_cliente_id:clienteId,p_request_id:requestId,p_lote_id:loteId,p_chave:chave});if(error)throw error;
   const resultado=consultaSchema.parse(data);if(resultado.requestId!==requestId)throw new Error("resposta_divergente");
   const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||!montado.current)throw new Error("sessao_alterada");setConferencia(resultado);
  }catch{if(montado.current)setAviso("Conferência indisponível ou acesso revogado. A tentativa permanece pendente.");}finally{trava.current=false;if(montado.current)setOcupado(false);}}
 async function cancelar(){if(!pendente||pendente==="invalido"||cancelamento==="invalido"||trava.current||!ciente)return;
  const atual=cancelamento??{requestId:pendente.requestId,motivo:motivo.trim()};if(atual.requestId!==pendente.requestId||!atual.motivo||atual.motivo.length>2000)return;
  trava.current=true;setOcupado(true);setAviso("");try{
   if(!cancelamento){if(sessionStorage.getItem(cancelKey)!==null)throw new Error("cancelamento_existente");sessionStorage.setItem(cancelKey,JSON.stringify(atual));setCancelamento(atual);}
   if(sessionStorage.getItem(cancelKey)!==JSON.stringify(atual)||sessionStorage.getItem(storageKey)!==JSON.stringify(pendente))throw new Error("tentativa_alterada");
   const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId)throw new Error("sessao_alterada");
   if(!montado.current||sessionStorage.getItem(cancelKey)!==JSON.stringify(atual)||sessionStorage.getItem(storageKey)!==JSON.stringify(pendente))throw new Error("tentativa_alterada");
   const {data,error}=await supabase.schema("pcm").rpc("sso_cancelar_ingestao_foto",{p_cliente_id:clienteId,p_request_id:atual.requestId,p_lote_id:loteId,p_chave:chave,p_motivo:atual.motivo});if(error)throw error;
   const r=z.object({requestId:z.string().uuid(),estado:z.literal("cancelada")}).strict().parse(data);if(r.requestId!==atual.requestId)throw new Error("resposta_divergente");
   const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||!montado.current)throw new Error("sessao_alterada");
   if(sessionStorage.getItem(cancelKey)!==JSON.stringify(atual)||sessionStorage.getItem(storageKey)!==JSON.stringify(pendente))throw new Error("tentativa_alterada");
   sessionStorage.removeItem(cancelKey);sessionStorage.removeItem(storageKey);setCancelamento(null);setPendente(null);setArquivo(null);setCiente(false);setMotivo("");setConferencia(null);setAviso("Tentativa cancelada. O objeto anterior pode permanecer privado; um novo envio terá outro identificador.");aoCancelar?.();
  }catch{if(montado.current)setAviso("Cancelamento não confirmado. Repita com o mesmo motivo ou consulte suporte.");}finally{trava.current=false;if(montado.current)setOcupado(false);}}
 return <section aria-label="Ingestão verificada de foto"><p>O servidor verifica os bytes; uma tentativa pendente não implica foto vinculada.</p>
  <label>Foto com verificação de integridade <input type="file" accept="image/jpeg,image/png" onChange={e=>setArquivo(e.target.files?.[0]??null)}/></label>
  <button type="button" disabled={!arquivo||ocupado||pendente==="invalido"||!!cancelamento} onClick={()=>void enviar()}>{pendente?"Repetir tentativa verificada":"Enviar foto verificada"}</button>
  {pendente&&pendente!=="invalido"?<p>Identificador da tentativa: {pendente.requestId}</p>:<label>Identificador da tentativa <input value={requestInformado} onChange={e=>setRequestInformado(e.target.value)} /></label>}
  <button type="button" disabled={ocupado||(!(pendente&&pendente!=="invalido")&&!z.string().uuid().safeParse(requestInformado.trim()).success)} onClick={()=>void consultar()}>Consultar conferência</button>
  {pendente&&pendente!=="invalido"&&<div><p>Cancelar impede confirmação futura desta tentativa. O objeto anterior não será apagado e pode permanecer privado.</p>
   <label>Motivo do cancelamento <input maxLength={2000} disabled={ocupado||!!cancelamento} value={cancelamento&&cancelamento!=="invalido"?cancelamento.motivo:motivo} onChange={e=>setMotivo(e.target.value)} /></label>
   <label><input type="checkbox" checked={ciente} onChange={e=>setCiente(e.target.checked)} /> Entendo que o objeto anterior pode permanecer privado</label>
   <button type="button" disabled={ocupado||!ciente||cancelamento==="invalido"||(!cancelamento&&!motivo.trim())} onClick={()=>void cancelar()}>Cancelar tentativa pendente</button>
   {cancelamento==="invalido"&&<p role="alert">Cancelamento local ilegível. Consulte suporte.</p>}</div>}
  {conferencia&&<div><p>{conferencia.confirmada?"Existe confirmação registrada; repita a tentativa para recuperar o recibo.":"Não há confirmação registrada nesta consulta."}</p>{conferencia.observacao?<p>Conferência registrada em {new Date(conferencia.observacao.observadoEm).toLocaleString("pt-BR")}: {conferencia.observacao.objetoCatalogado?"objeto catalogado":"objeto não catalogado"}; {conferencia.observacao.confirmada?"já havia confirmação":"sem confirmação naquele instante"}. Este registro não confirma a situação atual do objeto nem o término do upload.</p>:<p>Nenhuma conferência auditada registrada para esta tentativa.</p>}</div>}
  {pendente==="invalido"&&<p role="alert">Tentativa local ilegível. Consulte suporte.</p>}{aviso&&<p role="status">{aviso}</p>}
 </section>;
}
