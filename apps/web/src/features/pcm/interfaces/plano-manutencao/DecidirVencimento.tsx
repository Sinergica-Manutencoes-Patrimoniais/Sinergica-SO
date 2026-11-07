import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const schema=z.object({requestId:z.string().guid(),decisaoId:z.string().guid(),planoId:z.string().guid(),clienteId:z.string().guid(),revision:z.number().int().positive().safe(),versaoId:z.string().guid(),rotinaId:z.string().guid(),ciclo:z.number().int().nonnegative().safe(),vencimento:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),decisao:z.enum(["avaliar","tratar_manualmente"]),motivo:z.string().trim().min(1).max(2000)}).strict();
type Pedido=z.infer<typeof schema>;
type Props={userId:string;clienteId:string;planoId:string;revision:number;versaoId:string;rotinaId:string;ciclo:number;vencimento:string};
export function DecidirVencimento(props:Props) {
  if(import.meta.env.VITE_SSO_DECISAO_VENCIMENTO_MEDIADA_ENABLED!=="true")return <p>Decisão mediada indisponível; pedidos pendentes permanecem guardados.</p>;
  return <Abrir key={JSON.stringify([props.userId,props.clienteId,props.planoId,props.versaoId,props.rotinaId,props.ciclo,props.vencimento])} {...props}/>;
}
function Abrir(props:Props) {
  const [aberto,setAberto]=useState(false);
  return <section><button type="button" aria-expanded={aberto} onClick={()=>setAberto(v=>!v)}>{aberto?"Ocultar decisão preliminar":"Consultar decisão preliminar"}</button>{aberto&&<Conteudo {...props}/>}</section>;
}
function Conteudo({userId,clienteId,planoId,revision,versaoId,rotinaId,ciclo,vencimento}:Props) {
  const chave=`sso-decisao-vencimento:${JSON.stringify([userId,clienteId,planoId,versaoId,rotinaId,ciclo])}`;
  const [decisao,setDecisao]=useState<Pedido["decisao"]>("avaliar");const [motivo,setMotivo]=useState("");const [mensagem,setMensagem]=useState("");
  const [confirmado,setConfirmado]=useState<string|null>(null);const trava=useRef(false);
  const fotografia=JSON.stringify({userId,clienteId,planoId,revision,versaoId,rotinaId,ciclo,vencimento,decisao,motivo});
  const cache=useQueryClient();
  const historico=useInfiniteQuery({queryKey:["plano-vencimento-decisoes",userId,clienteId,planoId,versaoId,rotinaId,ciclo,vencimento],gcTime:0,
    initialPageParam:null as {data:string;id:string}|null,
    queryFn:async ({pageParam,signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");const parametros={
      p_plano_id:planoId,p_versao_id:versaoId,p_rotina_id:rotinaId,p_ciclo:ciclo,p_vencimento:vencimento,
      p_apos:pageParam?.data??null,p_apos_id:pageParam?.id??null,p_limite:30};if(import.meta.env.VITE_SSO_DECISAO_VENCIMENTO_MEDIADA_ENABLED!=="true")throw new Error("Consulta mediada indisponível.");const {data,error}=await supabase.schema("pcm").rpc("sso_historico_vencimento_mediado",{...parametros,p_ator_id:userId,p_cliente_id:clienteId}).abortSignal(signal);
      if(error)throw error;const pagina=z.array(z.object({id:z.string().guid(),decisao:z.enum(["avaliar","tratar_manualmente"]),motivo:z.string(),ator_id:z.string().guid(),criado_em:z.string()}).strict()).max(30).parse(data);
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(pagina) => {const ultima=pagina.at(-1);return pagina.length===30&&ultima ? {data:ultima.criado_em,id:ultima.id} : undefined;}});
  const [pedido,setPedido]=useState<Pedido|"invalido"|null>(() => {try{const salvo=sessionStorage.getItem(chave);if(!salvo)return null;const p=schema.parse(JSON.parse(salvo));
    return p&&p.clienteId===clienteId&&p.planoId===planoId&&p.versaoId===versaoId&&p.rotinaId===rotinaId&&p.ciclo===ciclo&&p.vencimento===vencimento&&
      typeof p.requestId==="string"&&typeof p.decisaoId==="string"&&Number.isSafeInteger(p.revision)&&typeof p.motivo==="string"&&["avaliar","tratar_manualmente"].includes(p.decisao) ? p : "invalido";}catch{return "invalido";}});
  const envio=useMutation({mutationFn:async(p:Pedido) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");const parametros={
    p_request_id:p.requestId,p_decisao_id:p.decisaoId,p_plano_id:p.planoId,p_expected_revision:p.revision,p_versao_id:p.versaoId,
    p_rotina_id:p.rotinaId,p_ciclo:p.ciclo,p_vencimento:p.vencimento,p_decisao:p.decisao,p_motivo:p.motivo};if(import.meta.env.VITE_SSO_DECISAO_VENCIMENTO_MEDIADA_ENABLED!=="true")throw new Error("Decisão mediada indisponível.");const {data,error}=await supabase.schema("pcm").rpc("sso_decisao_vencimento_mediada",{...parametros,p_ator_id:userId,p_cliente_id:clienteId});
    if(error)throw error;if(!data||data.requestId!==p.requestId||data.decisaoId!==p.decisaoId||data.efeitoOperacional!==false)throw new Error("Resposta inválida.");const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");},
    onSuccess:async(_r,p) => {try{await cache.invalidateQueries({queryKey:["plano-vencimento-decisoes",userId,clienteId,planoId,versaoId,rotinaId,ciclo,vencimento]});const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");sessionStorage.removeItem(chave);}catch{setMensagem("Decisão registrada, mas tentativa não foi removida. Procure suporte.");return;}
      setPedido(null);setConfirmado(null);setMensagem("Decisão preliminar registrada; obrigação não foi criada, cancelada nem concluída.");},
    onError:() => setMensagem("Resultado não confirmado. Repita mesmo pedido ou procure suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;trava.current=true;envio.mutate(p);}
  return <div><p>Histórico preliminar: este ciclo é candidato e ainda não comprova obrigação pendente.</p>
  {historico.isFetching&&<output>Carregando decisões…</output>}{historico.isError&&<p role="alert">Histórico indisponível. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
  {!historico.isFetching&&!historico.isError&&<ul>{historico.data?.pages.flat().map((d) => <li key={d.id}>{d.decisao} · {d.motivo} · {d.ator_id} · {d.criado_em}</li>)}</ul>}
  {historico.hasNextPage&&<button type="button" onClick={() => void historico.fetchNextPage()}>Mais decisões</button>}
  <form onSubmit={(event) => {event.preventDefault();if(pedido||trava.current||confirmado!==fotografia||!motivo.trim())return;
    const p:Pedido={requestId:crypto.randomUUID(),decisaoId:crypto.randomUUID(),planoId,clienteId,revision,versaoId,rotinaId,ciclo,vencimento,decisao,motivo:motivo.trim()};
    try{if(sessionStorage.getItem(chave)!==null){setMensagem("Há tentativa anterior; reabra para recuperar.");return;}sessionStorage.setItem(chave,JSON.stringify(p));}
    catch{setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}setPedido(p);enviar(p);
  }}><fieldset disabled={!!pedido||envio.isPending}><label>Decisão preliminar <select value={decisao} onChange={(e) => setDecisao(e.target.value as Pedido["decisao"])}>
    <option value="avaliar">Avaliar</option><option value="tratar_manualmente">Tratar manualmente</option></select></label>
    <label>Motivo <input required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)}/></label><label><input type="checkbox" checked={confirmado===fotografia} onChange={(e)=>setConfirmado(e.target.checked?fotografia:null)}/> Conferi ciclo, vencimento e decisão preliminar</label><button type="submit" disabled={confirmado!==fotografia}>Registrar decisão preliminar</button></fieldset></form>
    {pedido==="invalido"&&<p role="alert">Tentativa ilegível. Procure suporte.</p>}{pedido&&pedido!=="invalido"&&<button type="button" disabled={envio.isPending} onClick={() => enviar(pedido)}>Repetir mesmo pedido</button>}
    {mensagem&&<p role="status">{mensagem}</p>}
  </div>;
}
