import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function RecuperarAtualizacaoLote({storage,loteId}:{storage:string;loteId:string}){
 const [aviso,setAviso]=useState("");const [consultando,setConsultando]=useState(false);
 if(import.meta.env.VITE_SSO_RECUPERAR_ATUALIZACAO_LOTE_ENABLED!=="true")return null;
 async function consultar(){if(consultando)return;try{const raw=sessionStorage.getItem(storage);if(!raw)throw new Error();const tentativa=z.object({requestId:z.string().uuid(),loteId:z.string().uuid()}).passthrough().parse(JSON.parse(raw));if(tentativa.loteId!==loteId)throw new Error();setConsultando(true);const {data,error}=await supabase.schema("pcm").rpc("sso_recuperar_atualizacao_autorizada",{p_lote_id:loteId,p_request_id:tentativa.requestId});if(error)throw error;const r=z.object({loteId:z.string().uuid(),requestId:z.string().uuid(),situacao:z.enum(["registrado","nao_localizado"]),revision:z.number().int().optional(),quantidade:z.number().int().optional()}).strict().parse(data);if(r.loteId!==loteId || r.requestId!==tentativa.requestId)throw new Error();setAviso(r.situacao==="registrado"?`Tentativa registrada na revisão ${r.revision}; ${r.quantidade} item(ns). O conteúdo local foi preservado.`:"Tentativa não localizada. Isso não comprova falha; não reenvie automaticamente. Consulte suporte.");}catch{setAviso("Consulta indisponível ou identificador local ilegível. Consulte suporte; não reenvie automaticamente.");}finally{setConsultando(false);}}
 return <section><p>Recupere o resultado sem reenviar ou apagar a tentativa.</p><button type="button" disabled={consultando} onClick={()=>void consultar()}>Consultar tentativa anterior</button>{aviso && <p role="status">{aviso}</p>}</section>;
}
