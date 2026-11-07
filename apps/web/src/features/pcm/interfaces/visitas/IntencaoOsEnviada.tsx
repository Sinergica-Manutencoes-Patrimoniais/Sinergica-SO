import { useInfiniteQuery,useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { VisitaResumo } from "../../application/visitas-gateway";
import { supabaseVisitasAdapter } from "../../infrastructure/supabase-visitas-adapter";
import { TriagemIntencoes } from "./TriagemIntencoes";
import { TransferirOsEnviada } from "./TransferirOsEnviada";

const pedidoSchema=z.object({requestId:z.string().guid(),intencaoId:z.string().guid(),clienteId:z.string().guid(),origemId:z.string().guid(),destinoId:z.string().guid(),vinculoId:z.string().guid(),
  revisaoOrigem:z.number().int().positive().safe(),revisaoDestino:z.number().int().positive().safe(),motivo:z.string().trim().min(1).max(2000),
  material:z.object({listaId:z.string().guid(),eventoRevisao:z.number().int().min(2).safe()}).strict().optional()}).strict()
  .refine(p=>p.origemId.toLowerCase()!==p.destinoId.toLowerCase());
type Pedido=z.infer<typeof pedidoSchema>;
const excecaoSchema=z.object({lista_id:z.string().guid(),revisao:z.number().int().min(2),motivo:z.string(),descricao:z.string(),revisao_linhas:z.number().int().nullable(),posicao:z.number().int().nullable(),ator_id:z.string().guid(),criado_em:z.string().datetime({offset:true})}).strict();
const intencaoSchema=z.object({id:z.string().guid(),os_id:z.string().guid(),visita_origem_id:z.string().guid(),visita_destino_id:z.string().guid(),tarefa_auvo_id:z.string().min(1),estado:z.string().min(1),criado_em:z.string().datetime({offset:true})}).strict();
const origemMaterialSchema=z.object({intencaoId:z.string().guid(),osId:z.string().guid(),origem:z.object({listaId:z.string().guid(),eventoRevisao:z.number().int().min(2),registradoEm:z.string().datetime({offset:true}),motivo:z.string().min(1).max(50),descricao:z.string().min(1).max(4000)}).strict().nullable(),excecaoAtualComprovada:z.literal(false).optional()}).strict();
type Props = {userId:string;clienteId:string;visitas:VisitaResumo[];bloqueado:boolean};
export function IntencaoOsEnviada(props: Props) {
  return <IntencaoOsEnviadaInterna key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function IntencaoOsEnviadaInterna({userId,clienteId,visitas,bloqueado}: Props) {
  const chave=`sso-os-enviada-intencao:${JSON.stringify([userId,clienteId])}`;const cache=useQueryClient();
  const trava=useRef(false);
  const [origemId,setOrigemId]=useState("");const [destinoId,setDestinoId]=useState("");const [vinculoId,setVinculoId]=useState("");const [materialId,setMaterialId]=useState("");const [motivo,setMotivo]=useState("");const [mensagem,setMensagem]=useState("");
  const [confirmacao,setConfirmacao]=useState<string|null>(null);
  const [origemConsultada,setOrigemConsultada]=useState<{intencaoId:string;osId:string}|null>(null);
  const [pedido,setPedido]=useState<Pedido|"invalido"|null>(() => {try{const salvo=sessionStorage.getItem(chave);if(!salvo)return null;const p=pedidoSchema.parse(JSON.parse(salvo));
    return p.clienteId===clienteId ? p : "invalido";}catch{return "invalido";}});
  const origem=visitas.find((v) => v.id===origemId&&["confirmada","enviada","em_execucao","parcial"].includes(v.estado));
  const destino=visitas.find((v) => v.id===destinoId&&v.id!==origemId&&["rascunho","planejada","confirmada"].includes(v.estado));
  const ordens=useInfiniteQuery({queryKey:["visitas",userId,clienteId,"intencao-enviada-os",origemId],enabled:!!origem&&!bloqueado,gcTime:0,
    initialPageParam:null as {sequencia:number;id:string}|null,
    queryFn:async({pageParam,signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const pagina=await supabaseVisitasAdapter.listarOs({clienteId,visitaId:origemId,incluirHistorico:false,limite:20,apos:pageParam},signal);
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(pagina) => { const ultima = pagina.at(-1); return pagina.length===20 && ultima ? {sequencia:ultima.sequencia,id:ultima.id} : undefined; }});
  const osSelecionada=ordens.data?.pages.flat().find((o)=>o.id===vinculoId);
  const excecoes=useInfiniteQuery({queryKey:["visitas",userId,clienteId,"excecoes-intencao",osSelecionada?.osId],enabled:import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&!!osSelecionada&&!bloqueado,gcTime:0,
    initialPageParam:null as {lista:string;revisao:number}|null,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_listar_excecoes_para_intencao",{p_cliente_id:clienteId,p_os_id:osSelecionada!.osId,p_apos_lista:pageParam?.lista??null,p_apos_revisao:pageParam?.revisao??null,p_limite:20}).abortSignal(signal);if(error)throw error;
      const pagina=z.array(excecaoSchema).max(20).parse(data);let anterior=pageParam;for(const item of pagina){const lista=item.lista_id.toLowerCase();if(anterior&&(lista<anterior.lista.toLowerCase()||(lista===anterior.lista.toLowerCase()&&item.revisao<=anterior.revisao)))throw new Error("Página divergente.");anterior={lista,revisao:item.revisao};}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(pagina)=>{const ultima=pagina.at(-1);return pagina.length===20&&ultima?{lista:ultima.lista_id,revisao:ultima.revisao}:undefined;}});
  const material=excecoes.data?.pages.flat().find((e)=>JSON.stringify([e.lista_id,e.revisao])===materialId);
  const fotografia=JSON.stringify([userId,clienteId,origem??null,destino??null,osSelecionada??null,material??null,motivo.trim()]);
  const confirmado=confirmacao===fotografia;
  const intencoes=useInfiniteQuery({queryKey:["visitas",userId,clienteId,"intencoes-enviadas"],gcTime:0,initialPageParam:null as string|null,
    queryFn:async({pageParam,signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");const {data,error}=await supabase.schema("pcm").rpc("sso_listar_intencoes_os_mediada",{
      p_cliente_id:clienteId,p_apos:pageParam,p_limite:30}).abortSignal(signal);if(error)throw error;
      const pagina=z.array(intencaoSchema).max(30).parse(data);let anterior=pageParam?.toLowerCase()??"";
      for(const item of pagina){const atual=item.id.toLowerCase();if(atual<=anterior)throw new Error("Página divergente.");anterior=atual;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(pagina) => pagina.length===30 ? pagina.at(-1)?.id : undefined});
  const origemMaterial=useQuery({queryKey:["visitas",userId,clienteId,"origem-material-intencao",origemConsultada?.intencaoId,origemConsultada?.osId],enabled:import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&!!origemConsultada&&!bloqueado,gcTime:0,
    queryFn:async({signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted||!origemConsultada)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_origem_material_intencao",{p_cliente_id:clienteId,p_intencao_id:origemConsultada.intencaoId}).abortSignal(signal);if(error)throw error;
      const resposta=origemMaterialSchema.parse(data);if(resposta.intencaoId!==origemConsultada.intencaoId||resposta.osId!==origemConsultada.osId)throw new Error("Origem divergente.");
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return resposta;}});
  const envio=useMutation({mutationFn:async(p:Pedido) => {const antes=await supabase.auth.getUser();
    if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");
    const parametros={
    p_request_id:p.requestId,p_intencao_id:p.intencaoId,p_origem_id:p.origemId,p_destino_id:p.destinoId,p_vinculo_id:p.vinculoId,
    p_revisao_origem:p.revisaoOrigem,p_revisao_destino:p.revisaoDestino,p_motivo:p.motivo};
    const {data,error}=p.material?await supabase.schema("pcm").rpc("sso_propor_intencao_por_material",{...parametros,p_lista_id:p.material.listaId,p_evento_revisao:p.material.eventoRevisao}):await supabase.schema("pcm").rpc("sso_propor_intencao_os_mediada",parametros);if(error)throw error;
    if(!data||data.requestId!==p.requestId||data.intencaoId!==p.intencaoId||data.efeitoRemoto!==false||(p.material&&(data.listaId!==p.material.listaId||data.eventoRevisao!==p.material.eventoRevisao)))throw new Error("Resposta inválida.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");},
    onSuccess:async(_resultado,p) => {try{await cache.invalidateQueries({queryKey:["visitas",userId,clienteId,"intencoes-enviadas"]});
      const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();
      sessionStorage.removeItem(chave);}catch{setMensagem("Intenção registrada, mas tentativa local mudou ou não foi removida. Procure suporte.");return;}
      setPedido(null);setConfirmacao(null);setMensagem("Intenção pendente registrada. A OS e tarefa remota não foram reprogramadas.");},
    onError:() => setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."),onSettled:() => {trava.current=false;}});
  const enviar=(p:Pedido) => {if(trava.current||bloqueado)return;
    try{if(sessionStorage.getItem(chave)!==JSON.stringify(p)){setMensagem("Tentativa local alterada. Reabra para conferi-la.");return;}}
    catch{setMensagem("Não foi possível conferir tentativa; nada foi enviado.");return;}
    trava.current=true;envio.mutate(p);};
  return <section aria-label="Intenção de reprogramação de OS enviada"><h3>Intenção de reprogramação de OS enviada</h3>
    {import.meta.env.VITE_SSO_TRANSFERENCIA_OS_ENVIADA_ENABLED === "true" && <TransferirOsEnviada userId={userId} clienteId={clienteId} visitas={visitas} bloqueado={bloqueado} />}
    {import.meta.env.VITE_SSO_TRIAGEM_INTENCAO_OS_ENABLED === "true" && <TriagemIntencoes userId={userId} clienteId={clienteId} />}
    <p>Registro interno apenas: não move OS, não altera horário nem tarefa Auvo. A reconciliação e execução estão bloqueadas.</p>
    <form onSubmit={(event) => {event.preventDefault();if(pedido||trava.current||bloqueado||!confirmado||!origem||!destino||!motivo.trim()||ordens.isFetching||ordens.isError||!ordens.data?.pages.flat().some((o) => o.id===vinculoId)||(materialId&&(import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED!=="true"||!material||excecoes.isFetching||excecoes.isError)))return;
      const validacao=pedidoSchema.safeParse({requestId:crypto.randomUUID(),intencaoId:crypto.randomUUID(),clienteId,origemId:origem.id,destinoId:destino.id,vinculoId,revisaoOrigem:origem.revisao,revisaoDestino:destino.revisao,motivo:motivo.trim(),...(material?{material:{listaId:material.lista_id,eventoRevisao:material.revisao}}:{})});
      if(!validacao.success){setMensagem("Confira OS, Visitas, revisões e motivo.");return;}const p=validacao.data;
      try{if(sessionStorage.getItem(chave)!==null){setMensagem("Há tentativa anterior; reabra para recuperar.");return;}sessionStorage.setItem(chave,JSON.stringify(p));}
      catch{setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}setPedido(p);enviar(p);
    }}><fieldset disabled={!!pedido||bloqueado||envio.isPending}>
      <label>Origem <select required value={origemId} onChange={(e) => {setOrigemId(e.target.value);setVinculoId("");setMaterialId("");}}><option value="">Selecione</option>
        {visitas.filter((v) => ["confirmada","enviada","em_execucao","parcial"].includes(v.estado)).map((v) => <option key={v.id} value={v.id}>{v.inicioEm} · {v.estado}</option>)}</select></label>
      <label>Destino <select required value={destinoId} onChange={(e) => setDestinoId(e.target.value)}><option value="">Selecione</option>
        {visitas.filter((v) => v.id!==origemId&&["rascunho","planejada","confirmada"].includes(v.estado)).map((v) => <option key={v.id} value={v.id}>{v.inicioEm} · {v.estado}</option>)}</select></label>
      {ordens.isFetching&&origem&&<output>Carregando OS…</output>}{ordens.isError&&<p role="alert">OS indisponíveis. <button type="button" onClick={() => void ordens.refetch()}>Tentar novamente</button></p>}
      <label>OS <select required value={vinculoId} onChange={(e) => {setVinculoId(e.target.value);setMaterialId("");}}><option value="">Selecione</option>
        {ordens.data?.pages.flat().map((o) => <option key={o.id} value={o.id}>{o.numero} · {o.titulo}</option>)}</select></label>
      {ordens.hasNextPage&&<button type="button" onClick={() => void ordens.fetchNextPage()}>Mais OS</button>}
      {import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&osSelecionada&&<>
        <p>A associação registra um evento histórico; não confirma que a exceção ainda está aberta.</p>
        {excecoes.isFetching&&<output>Carregando exceções…</output>}
        {excecoes.isError&&<p role="alert">Exceções indisponíveis. <button type="button" onClick={()=>void excecoes.refetch()}>Tentar novamente</button></p>}
        <label>Exceção de material (opcional) <select value={materialId} disabled={excecoes.isFetching||excecoes.isError} onChange={(e)=>setMaterialId(e.target.value)}><option value="">Sem associação</option>
          {excecoes.data?.pages.flat().map((e)=><option key={`${e.lista_id}:${e.revisao}`} value={JSON.stringify([e.lista_id,e.revisao])}>{e.motivo} · {e.descricao} · revisão {e.revisao}</option>)}</select></label>
        {excecoes.hasNextPage&&<button type="button" disabled={excecoes.isFetching} onClick={()=>void excecoes.fetchNextPage()}>Mais exceções</button>}
      </>}
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)}/></label>
      <label><input type="checkbox" checked={confirmado} onChange={(e)=>setConfirmacao(e.target.checked?fotografia:null)}/> Conferi OS, Visitas, motivo e eventual exceção de material. Entendo que este registro não suspende nem reprograma a OS.</label>
      <button type="submit" disabled={!confirmado}>Registrar intenção</button>
    </fieldset></form>
    {pedido==="invalido"&&<p role="alert">Tentativa ilegível. Procure suporte.</p>}{pedido&&pedido!=="invalido"&&<button type="button" disabled={bloqueado||envio.isPending} onClick={() => enviar(pedido)}>Repetir mesmo pedido</button>}
    {mensagem&&<p role="status">{mensagem}</p>}
    {intencoes.isFetching&&<output>Carregando intenções…</output>}{intencoes.isError&&<p role="alert">Intenções indisponíveis. <button type="button" onClick={() => void intencoes.refetch()}>Tentar novamente</button></p>}
    {!intencoes.isFetching&&!intencoes.isError&&<ul>{intencoes.data?.pages.flat().map((i) => <li key={i.id}>OS {i.os_id} · tarefa {i.tarefa_auvo_id} · {i.estado} · origem {i.visita_origem_id} · destino {i.visita_destino_id}
      {import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&<button type="button" disabled={bloqueado} onClick={()=>setOrigemConsultada({intencaoId:i.id,osId:i.os_id})}>Consultar origem de material</button>}</li>)}</ul>}
    {!intencoes.isError&&intencoes.hasNextPage&&<button type="button" disabled={intencoes.isFetching} onClick={() => void intencoes.fetchNextPage()}>Mais intenções</button>}
    {origemConsultada&&!bloqueado&&!intencoes.isFetching&&!intencoes.isError&&intencoes.data?.pages.flat().some((i)=>i.id===origemConsultada.intencaoId&&i.os_id===origemConsultada.osId)&&import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&<section aria-label="Origem de material da intenção"><h4>Origem de material</h4>
      {origemMaterial.isFetching&&<output>Consultando origem…</output>}
      {origemMaterial.isError&&<p role="alert">Não foi possível consultar a origem. <button type="button" onClick={()=>void origemMaterial.refetch()}>Tentar novamente</button></p>}
      {!origemMaterial.isFetching&&!origemMaterial.isError&&origemMaterial.data&&(origemMaterial.data.origem?<p>Lista {origemMaterial.data.origem.listaId} · revisão {origemMaterial.data.origem.eventoRevisao} · {origemMaterial.data.origem.motivo}: {origemMaterial.data.origem.descricao}. O vínculo é histórico e não confirma exceção aberta.</p>:<p>Nenhuma origem de material associada a esta intenção.</p>)}
      <button type="button" onClick={()=>setOrigemConsultada(null)}>Fechar origem</button></section>}
  </section>;
}
