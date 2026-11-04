import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { PreviaFotosDestino } from "./PreviaFotosDestino";
import { DecisaoFoto } from "./DecisaoFoto";
import { VincularFotoAtivo } from "./VincularFotoAtivo";
import { VincularFotoEquipamento } from "./VincularFotoEquipamento";
import { VincularAnexoLocalizacao } from "./VincularAnexoLocalizacao";
import { AdequacaoFoto } from "./AdequacaoFoto";
import { RetiradaAnexo } from "./RetiradaAnexo";
import { FotosIngestaoSegura } from "./FotosIngestaoSegura";
import { FotoVerificada } from "./FotoVerificada";
import { ConferenciaFotosCanceladas } from "./ConferenciaFotosCanceladas";
import { VincularFotoVerificadaGrupo } from "./VincularFotoVerificadaGrupo";
const schema=z.object({requestId:z.string().uuid(),clienteId:z.string().uuid(),loteId:z.string().uuid(),chave:z.string().min(1).max(200),nome:z.string(),hash:z.string().regex(/^[a-f0-9]{64}$/),tipo:z.enum(["image/jpeg","image/png"])}).strict();type Pedido=z.infer<typeof schema>;
type Props={userId:string;clienteId:string;loteId:string;chave:string};
export function FotosLevantamento(props:Props){if(import.meta.env.VITE_SSO_FOTOS_LEVANTAMENTO_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.loteId,props.chave])} {...props}/>;}
function Conteudo({userId,clienteId,loteId,chave}:Props){
  const key=`sso-foto-levantamento:${JSON.stringify([userId,clienteId,loteId,chave])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const raw=sessionStorage.getItem(key);if(!raw)return null;const p=schema.parse(JSON.parse(raw));return p.clienteId===clienteId && p.loteId===loteId && p.chave===chave && p.nome.startsWith(`${clienteId}/${loteId}/`) ? p : "invalido";}catch{return "invalido";}});
  const [arquivo,setArquivo]=useState<File|null>(null);const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  async function conferirSessao(signal?:AbortSignal){const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||signal?.aborted)throw new Error("Sessão alterada.");}
  const fotos=useInfiniteQuery({queryKey:["levantamentos",userId,clienteId,loteId,chave,"fotos"],gcTime:0,initialPageParam:null as string|null,queryFn:async({pageParam,signal})=>{await conferirSessao(signal);const {data,error}=await supabase.schema("pcm").rpc("sso_fotos_levantamento_autorizadas",{p_lote_id:loteId,p_chave:chave,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const pagina=z.array(z.object({id:z.string().uuid(),criado_em:z.string().datetime({offset:true})}).strict()).max(20).parse(data);await conferirSessao(signal);return pagina;},getNextPageParam:p=>p.length===20 ? p[p.length - 1]?.id : undefined});
  const envio=useMutation({mutationFn:async({p,imagem}:{p:Pedido;imagem:File})=>{const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",await imagem.arrayBuffer()));if(Array.from(digest,v=>v.toString(16).padStart(2,"0")).join("")!==p.hash || imagem.type!==p.tipo || imagem.size===0 || imagem.size>10485760)throw new Error("Arquivo divergente");
    await conferirSessao();if(sessionStorage.getItem(key)!==JSON.stringify(p))throw new Error("Tentativa divergente.");
    const upload=await supabase.storage.from("sso-levantamento-fotos").upload(p.nome,imagem,{contentType:p.tipo,upsert:false});if(upload.error)throw upload.error;
    await conferirSessao();if(sessionStorage.getItem(key)!==JSON.stringify(p))throw new Error("Tentativa divergente.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_vincular_foto_levantamento_autorizado",{p_request_id:p.requestId,p_lote_id:loteId,p_chave:chave,p_nome:p.nome});if(error)throw error;
    const r=z.object({fotoId:z.string().uuid(),loteId:z.string().uuid(),chave:z.string(),requestId:z.string().uuid()}).strict().parse(data);if(r.loteId!==loteId || r.chave!==chave || r.requestId!==p.requestId)throw new Error("Resposta divergente");
    await conferirSessao();
  },onSuccess:async(_r,{p})=>{try{await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId],refetchType:"none"});await conferirSessao();if(sessionStorage.getItem(key)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(key);}catch{setAviso("Foto vinculada; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setArquivo(null);setAviso("Foto vinculada ao levantamento, não ao cadastro oficial.");void client.refetchQueries({queryKey:["levantamentos",userId,clienteId],type:"active"});},onError:()=>setAviso("Resultado não confirmado. Selecione o mesmo arquivo e repita ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  const recibo=useMutation({mutationFn:async(p:Pedido)=>{await conferirSessao();if(sessionStorage.getItem(key)!==JSON.stringify(p))throw new Error("Tentativa divergente.");const {data,error}=await supabase.schema("pcm").rpc("sso_recibo_foto_levantamento_autorizado",{p_request_id:p.requestId,p_lote_id:p.loteId,p_chave:p.chave,p_nome:p.nome});if(error)throw error;await conferirSessao();if(data===null)return null;const r=z.object({fotoId:z.string().uuid(),loteId:z.string().uuid(),chave:z.string(),requestId:z.string().uuid()}).strict().parse(data);if(r.loteId!==p.loteId || r.chave!==p.chave || r.requestId!==p.requestId)throw new Error("Recibo divergente");return r;},onSuccess:async(r,p)=>{if(!r){setAviso("Não há vínculo confirmado para esta tentativa. O upload pode ter ocorrido; consulte suporte.");return;}try{await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId],refetchType:"none"});await conferirSessao();if(sessionStorage.getItem(key)!==JSON.stringify(p))throw new Error();sessionStorage.removeItem(key);}catch{setAviso("Vínculo confirmado; não foi possível limpar a tentativa local. Consulte suporte.");return;}setPendente(null);setArquivo(null);setAviso("Vínculo anteriormente registrado confirmado; a foto não foi publicada no cadastro oficial.");void client.refetchQueries({queryKey:["levantamentos",userId,clienteId],type:"active"});},onError:()=>setAviso("Não foi possível consultar o recibo. A tentativa permanece pendente.")});
  async function enviar(){if(!arquivo || trava.current || pendente==="invalido")return;trava.current=true;try{if(!["image/jpeg","image/png"].includes(arquivo.type) || arquivo.size===0 || arquivo.size>10485760)throw new Error("Arquivo inválido");const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",await arquivo.arrayBuffer()));const hash=Array.from(digest,v=>v.toString(16).padStart(2,"0")).join("");const p=pendente ?? schema.parse({requestId:crypto.randomUUID(),clienteId,loteId,chave,nome:`${clienteId}/${loteId}/${crypto.randomUUID()}`,hash,tipo:arquivo.type});if(p.hash!==hash || p.tipo!==arquivo.type)throw new Error("Arquivo diferente");if(!pendente){if(sessionStorage.getItem(key)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(key,JSON.stringify(p));setPendente(p);}envio.mutate({p,imagem:arquivo});}catch{trava.current=false;setAviso("Selecione JPEG/PNG de até 10 MiB; para repetir, use o mesmo arquivo.");}}
  return <section aria-label="Fotos do levantamento"><h5>Fotos do levantamento</h5><p>As fotos permanecem no levantamento e não são copiadas ao cadastro oficial.</p><PreviaFotosDestino userId={userId} clienteId={clienteId} loteId={loteId} chave={chave}/>{fotos.isPending && <output>Carregando fotos…</output>}{fotos.isError && <p role="alert">Fotos indisponíveis. <button type="button" onClick={()=>void fotos.refetch()}>Tentar novamente</button></p>}{!fotos.isFetching && !fotos.isError && fotos.data?.pages.flat().map(f=><RetiradaAnexo key={f.id} userId={userId} clienteId={clienteId} tipo="foto" anexoId={f.id}><Foto userId={userId} fotoId={f.id}/><FotoVerificada userId={userId} fotoId={f.id}/><DecisaoFoto userId={userId} clienteId={clienteId} fotoId={f.id}/><AdequacaoFoto userId={userId} clienteId={clienteId} fotoId={f.id}/><VincularFotoAtivo userId={userId} clienteId={clienteId} fotoId={f.id}/><VincularFotoVerificadaGrupo userId={userId} clienteId={clienteId} fotoId={f.id}/><VincularFotoEquipamento userId={userId} clienteId={clienteId} fotoId={f.id}/><VincularAnexoLocalizacao userId={userId} clienteId={clienteId} tipo="foto" anexoId={f.id}/></RetiradaAnexo>)}{fotos.hasNextPage && <button type="button" disabled={fotos.isFetching} onClick={()=>void fotos.fetchNextPage()}>Mais fotos</button>}
    <label>Imagem JPEG ou PNG <input type="file" accept="image/jpeg,image/png" onChange={e=>setArquivo(e.target.files?.[0] ?? null)}/></label><button type="button" disabled={!arquivo || envio.isPending || recibo.isPending || pendente==="invalido"} onClick={()=>void enviar()}>{pendente ? "Repetir envio" : "Adicionar foto"}</button>{pendente && pendente!=="invalido" && <button type="button" disabled={envio.isPending || recibo.isPending} onClick={()=>recibo.mutate(pendente)}>Consultar vínculo confirmado</button>}{pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}{aviso && <p role="status">{aviso}</p>}
    <FotosIngestaoSegura userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} aoConfirmar={()=>void client.invalidateQueries({queryKey:["levantamentos",userId,clienteId,loteId,chave,"fotos"]})} aoCancelar={()=>void client.invalidateQueries({queryKey:["conferencia-fotos-canceladas",userId,clienteId,loteId,chave]})}/>
    <ConferenciaFotosCanceladas userId={userId} clienteId={clienteId} loteId={loteId} chave={chave}/>
  </section>;
}
function Foto({userId,fotoId}:{userId:string;fotoId:string}) {
  const [url,setUrl]=useState<string|null>(null);
  const [erro,setErro]=useState(false);
  const [abrindo,setAbrindo]=useState(false);
  const geracao=useRef(0);
  useEffect(()=>()=>{geracao.current++;},[]);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  async function abrir(){
    const atual=++geracao.current;setAbrindo(true);setErro(false);
    try {
      const antes=await supabase.auth.getUser();
      if(antes.error||antes.data.user?.id!==userId||geracao.current!==atual)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.functions.invoke("pcm-foto-levantamento-segura",{body:{fotoId}});
      if(error||!(data instanceof Blob)||!["image/jpeg","image/png"].includes(data.type)||data.size>10485760)throw new Error("Foto inválida.");
      const depois=await supabase.auth.getUser();
      if(depois.error||depois.data.user?.id!==userId||geracao.current!==atual)throw new Error("Sessão alterada.");
      setUrl(URL.createObjectURL(data));
    } catch {if(geracao.current===atual)setErro(true);}
    finally {if(geracao.current===atual)setAbrindo(false);}
  }
  return <div>{url ? <><img src={url} alt="Foto do levantamento"/><button type="button" onClick={()=>setUrl(null)}>Ocultar foto</button></> : <button type="button" disabled={abrindo} onClick={()=>void abrir()}>Ver foto</button>}{erro && <p role="alert">Foto indisponível ou acesso não autorizado.</p>}</div>;
}
