import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid=z.string().guid();
const pedido=z.object({ator:uuid,cliente:uuid,os:uuid,requestId:uuid,lista:uuid,evento:z.number().int().min(2),revision:z.number().int().nonnegative(),estado:z.enum(["suspenso","retomado"]),motivo:z.string().trim().min(1).max(2000)}).strict();
type Pedido=z.infer<typeof pedido>;
const evento=z.object({revisao:z.number().int().positive(),lista_id:uuid,evento_revision:z.number().int().min(2),estado:z.enum(["suspenso","retomado"]),motivo:z.string(),ator_id:uuid,criado_em:z.string()}).strict();
type Props={usuario:string;cliente:string;os:string;lista:string;eventoRevision:number};
export function ImpedimentoMaterialOs(props:Props){
  if(import.meta.env.VITE_SSO_IMPEDIMENTO_MATERIAL_OS_ENABLED!=="true")return null;
  return <Conteudo key={JSON.stringify([props.usuario,props.cliente,props.os,props.lista,props.eventoRevision])} {...props}/>;
}
function Conteudo({usuario,cliente,os,lista,eventoRevision}:Props){
  const [aberto,setAberto]=useState(false);const [motivo,setMotivo]=useState("");const [confirmado,setConfirmado]=useState<string|null>(null);const [aviso,setAviso]=useState("");const [ocupado,setOcupado]=useState(false);const trava=useRef(false);const cache=useQueryClient();
  const chave=`sso-impedimento-material:${JSON.stringify([usuario,cliente,os])}`;
  const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const raw=sessionStorage.getItem(chave);if(!raw)return null;const p=pedido.parse(JSON.parse(raw));return p.ator===usuario&&p.cliente===cliente&&p.os===os?p:"invalido";}catch{return "invalido";}});
  async function ator(){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==usuario)throw new Error("Sessão alterada.");}
  const historico=useInfiniteQuery({queryKey:["impedimento-material-os",usuario,cliente,os],enabled:aberto,gcTime:0,retry:false,initialPageParam:null as number|null,
    queryFn:async({pageParam,signal})=>{await ator();const {data,error}=await supabase.schema("pcm").rpc("sso_listar_impedimentos_material_os",{p_ator_id:usuario,p_cliente_id:cliente,p_os_id:os,p_antes:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const linhas=z.array(evento).max(20).parse(data);let anterior=pageParam??Number.MAX_SAFE_INTEGER;for(const l of linhas){if(l.revisao>=anterior)throw new Error("Página divergente.");anterior=l.revisao;}await ator();if(signal.aborted)throw new Error("Consulta cancelada.");return linhas;},
    getNextPageParam:p=>p.length===20?p.at(-1)?.revisao:undefined});
  const ultimo=historico.data?.pages[0]?.[0];const revision=ultimo?.revisao??0;
  const podeRetomar=ultimo?.estado==="suspenso"&&ultimo.lista_id===lista&&ultimo.evento_revision===eventoRevision;
  const estado=ultimo?.estado==="suspenso"?"retomado":"suspenso";
  const fotografia=JSON.stringify({usuario,cliente,os,lista,eventoRevision,revision,estado,motivo});
  async function enviar(p:Pedido){if(trava.current)return;trava.current=true;setOcupado(true);setAviso("");try{await ator();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");const {data,error}=await supabase.schema("pcm").rpc("sso_declarar_impedimento_material_os",{p_ator_id:p.ator,p_cliente_id:p.cliente,p_os_id:p.os,p_request_id:p.requestId,p_lista_id:p.lista,p_evento_revision:p.evento,p_expected_revision:p.revision,p_estado:p.estado,p_motivo:p.motivo});if(error)throw error;const r=z.object({requestId:uuid,clienteId:uuid,osId:uuid,listaId:uuid,eventoRevision:z.number().int(),revision:z.number().int(),estado:z.enum(["suspenso","retomado"]),efeitoRemoto:z.literal(false),osAlterada:z.literal(false)}).strict().parse(data);if(r.requestId!==p.requestId||r.clienteId!==p.cliente||r.osId!==p.os||r.listaId!==p.lista||r.eventoRevision!==p.evento||r.revision!==p.revision+1||r.estado!==p.estado)throw new Error("Recibo divergente.");await ator();await cache.invalidateQueries({queryKey:["impedimento-material-os",usuario,cliente,os]});await ator();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");sessionStorage.removeItem(chave);setPendente(null);setConfirmado(null);setAviso("Intenção registrada; a OS e a tarefa remota não foram alteradas.");}catch{setAviso("Resultado não confirmado. Repita a mesma tentativa ou procure suporte.");}finally{trava.current=false;setOcupado(false);}}
  return <section aria-label="Intenção de impedimento por material"><button type="button" aria-expanded={aberto} onClick={()=>setAberto(v=>!v)}>{aberto?"Ocultar impedimento":"Consultar impedimento"}</button>{aberto&&<>
    <p>Registro preparatório: não suspende OS ou tarefa Auvo, não impede execução e não reprograma Visita.</p>
    {historico.isFetching&&<output>Consultando histórico…</output>}{historico.isError&&<p role="alert">Histórico indisponível. <button type="button" onClick={()=>void historico.refetch()}>Tentar novamente</button></p>}
    {!historico.isFetching&&!historico.isError&&historico.data&&<><p>Última intenção: {ultimo?.estado??"nenhuma"} · revisão {revision}.</p>
      <ul>{historico.data.pages.flat().map(e=><li key={e.revisao}>Revisão {e.revisao} · {e.estado} · lista {e.lista_id} · exceção {e.evento_revision} · {e.motivo} · {e.ator_id} · {e.criado_em}</li>)}</ul>
      {historico.hasNextPage&&<button type="button" onClick={()=>void historico.fetchNextPage()}>Mais histórico</button>}
      {ultimo?.estado==="suspenso"&&!podeRetomar&&<p role="alert">A intenção atual pertence a outra exceção. Consulte-a para registrar retomada.</p>}
      {!pendente&&(ultimo?.estado!=="suspenso"||podeRetomar)&&<form onSubmit={e=>{e.preventDefault();if(ocupado||confirmado!==fotografia||!motivo.trim())return;try{const p=pedido.parse({ator:usuario,cliente,os,lista,evento:eventoRevision,revision,estado,motivo:motivo.trim(),requestId:crypto.randomUUID()});if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);void enviar(p);}catch{setAviso("Confira os dados e a tentativa local.");}}}>
        <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label>
        <label><input type="checkbox" checked={confirmado===fotografia} onChange={e=>setConfirmado(e.target.checked?fotografia:null)}/> Conferi OS, exceção e intenção de {estado}.</label>
        <button disabled={ocupado||confirmado!==fotografia}>Registrar intenção</button>
      </form>}
    </>}
    {pendente==="invalido"&&<p role="alert">Tentativa inválida; procure suporte.</p>}{pendente&&pendente!=="invalido"&&<button type="button" disabled={ocupado} onClick={()=>void enviar(pendente)}>Repetir pedido pendente</button>}{aviso&&<p role="status">{aviso}</p>}
  </>}</section>;
}
