import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id=z.string().guid();
const pedidoSchema=z.object({requestId:id,atorId:id,clienteId:id,outboxIds:z.array(id).min(1).max(50)}).strict()
  .refine((p)=>new Set(p.outboxIds.map((v)=>v.toLowerCase())).size===p.outboxIds.length);
type Pedido=z.infer<typeof pedidoSchema>;
const reciboSchema=z.object({requestId:id,clienteId:id,efeitoRemotoComprovado:z.literal(false),itens:z.array(z.object({outboxId:id,
  revisao:z.number().int().positive(),estado:z.enum(["pendente","incerto","enviado_nao_confirmado"]),
  estadoFonte:z.enum(["pending","processing","error","sent"]),tentativas:z.number().int().nonnegative().safe()}).strict()).min(1).max(50)}).strict();

export function ObservarSelecaoFila({userId,clienteId,selecionados,limparSelecao}:{userId:string;clienteId:string;selecionados:string[];limparSelecao:()=>void}){
  const chave=`sso-observacao-fila-lote:${JSON.stringify([userId,clienteId])}`;const trava=useRef(false);const cache=useQueryClient();
  const [ocupado,setOcupado]=useState(false);const [confirmacao,setConfirmacao]=useState<string|null>(null);const [aviso,setAviso]=useState("");
  const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const texto=sessionStorage.getItem(chave);if(!texto)return null;const p=pedidoSchema.parse(JSON.parse(texto));return p.atorId===userId&&p.clienteId===clienteId?p:"invalido";}catch{return "invalido";}});
  const ids=[...selecionados].sort();const fotografia=JSON.stringify({userId,clienteId,ids});
  async function enviar(p:Pedido){if(trava.current)return;try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();}catch{setAviso("Pedido alterado. Procure suporte.");return;}
    trava.current=true;setOcupado(true);setAviso("");try{
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_observar_fila_reconciliacao",{p_ator_id:userId,p_cliente_id:clienteId,p_request_id:p.requestId,p_outbox_ids:p.outboxIds});if(error)throw error;
      const r=reciboSchema.parse(data);const esperados=p.outboxIds.map((v)=>v.toLowerCase()).sort();const recebidos=r.itens.map((v)=>v.outboxId.toLowerCase()).sort();
      if(r.requestId!==p.requestId||r.clienteId!==clienteId||JSON.stringify(esperados)!==JSON.stringify(recebidos)||r.itens.some((item)=>item.estado!==(item.estadoFonte==="pending"?"pendente":item.estadoFonte==="sent"?"enviado_nao_confirmado":"incerto")))throw new Error("Recibo divergente.");
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");
      await Promise.all([cache.invalidateQueries({queryKey:["reconciliacao-outbox",userId,clienteId]}),cache.invalidateQueries({queryKey:["reconciliacao-observacoes",userId,clienteId]})]);
      const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido alterado.");
      sessionStorage.removeItem(chave);setPendente(null);setConfirmacao(null);limparSelecao();setAviso(`${r.itens.length} item(ns) observados. Resultados remotos continuam desconhecidos.`);
    }catch{setAviso("Resultado não confirmado. Preserve e repita o mesmo pedido ou procure suporte.");}finally{trava.current=false;setOcupado(false);}}
  function iniciar(){if(pendente||trava.current||confirmacao!==fotografia)return;try{const p=pedidoSchema.parse({requestId:crypto.randomUUID(),atorId:userId,clienteId,outboxIds:ids});if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);void enviar(p);}catch{setAviso("Confira a seleção e o armazenamento; nada foi enviado.");}}
  return <section aria-label="Observação da seleção"><h3>Registrar observação da seleção</h3>
    <p>{ids.length} de 50 itens selecionados. O servidor lê o estado no momento da gravação; não retenta, confirma nem altera o destino.</p>
    {ids.length>0&&<details><summary>Conferir identificadores selecionados</summary><p>Itens permanecem selecionados mesmo se o filtro ou a página mudar.</p><ul>{ids.map((valor)=><li key={valor}>{valor}</li>)}</ul></details>}
    {pendente==="invalido"?<p role="alert">Pedido ilegível. Procure suporte.</p>:pendente?<><p>Pedido pendente: {pendente.outboxIds.length} item(ns), identificador {pendente.requestId}.</p><button type="button" disabled={ocupado} onClick={()=>void enviar(pendente)}>Repetir mesmo pedido</button></>:<>
      {confirmacao&&confirmacao!==fotografia&&<p role="alert">Seleção alterada; confira novamente.</p>}
      <label><input type="checkbox" checked={confirmacao===fotografia} disabled={ocupado||ids.length===0||ids.length>50} onChange={(e)=>setConfirmacao(e.target.checked?fotografia:null)}/> Conferi a seleção; registrar apenas observações locais.</label>
      <button type="button" disabled={ocupado||ids.length===0||ids.length>50||confirmacao!==fotografia} onClick={iniciar}>Observar seleção</button>
    </>}{aviso&&<p role="status">{aviso}</p>}
  </section>;
}
