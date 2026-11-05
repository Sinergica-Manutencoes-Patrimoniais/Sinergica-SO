import { conflitoPreparacaoVisita } from "./conflito-preparacao-visita";
import { useInfiniteQuery,useMutation,useQueryClient } from "@tanstack/react-query";
import { useRef,useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { LoteOcorrenciasVisita } from "./LoteOcorrenciasVisita";
import { OrigemGeracaoRotina } from "./OrigemGeracaoRotina";
import { ConferenciaPmocCiclo } from "./ConferenciaPmocCiclo";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { FilaPreventivaPcm } from "./FilaPreventivaPcm";
import { IntegrarOrigemOcorrencia } from "./IntegrarOrigemOcorrencia";

type Candidato={visita_id:string;semana_origem:string;vencimento_original:string;estado_visita:string;feriado_declarado:boolean;vigencia_declarada:boolean;ocorrencia_preparada:boolean};
type Pedido={requestId:string;ocorrenciaId:string;clienteId:string;planoId:string;versaoId:string;rotinaId:string;visitaId:string;revision:number;fonte:string;modo?:"canonico"|"anterior"};
export function PreviaOcorrenciasVisita(props: Parameters<typeof Conteudo>[0]) {
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.planoId,props.versaoId,props.rotinaId,props.serieId])} {...props} />;
}
function Conteudo({userId,clienteId,planoId,versaoId,rotinaId,serieId,revision}:{userId:string;clienteId:string;planoId:string;versaoId:string;rotinaId:string;serieId:string;revision:number}) {
  const chave=`sso-preparar-ocorrencia-visita:${JSON.stringify([userId,clienteId,planoId,rotinaId,serieId])}`;const cache=useQueryClient();const trava=useRef(false);const primeira=useRef(false);
  const [inicio,setInicio]=useState("");const [fim,setFim]=useState("");const [periodo,setPeriodo]=useState<{inicio:string;fim:string}|null>(null);
  const [fonte,setFonte]=useState("");const [selecionado,setSelecionado]=useState("");const [mensagem,setMensagem]=useState("");
  const [resultado,setResultado]=useState<{visitaId:string;ocorrenciaId:string}|null>(null);const [filaAberta,setFilaAberta]=useState(false);
  const [confirmado,setConfirmado]=useState<string|null>(null);const modo=import.meta.env.VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED === "true" ? "canonico" : "anterior";
  const [pedido,setPedido]=useState<Pedido|"invalido"|null>(() => {try{const salvo=sessionStorage.getItem(chave);if(!salvo)return null;const p=JSON.parse(salvo) as Pedido;
    return p&&p.clienteId===clienteId&&p.planoId===planoId&&p.versaoId===versaoId&&p.rotinaId===rotinaId&&typeof p.requestId==="string"&&typeof p.ocorrenciaId==="string"&&
      typeof p.visitaId==="string"&&Number.isSafeInteger(p.revision)&&typeof p.fonte==="string"&&(p.modo===undefined||p.modo==="canonico"||p.modo==="anterior") ? p : "invalido";}catch{return "invalido";}});
  const candidatos=useInfiniteQuery({queryKey:["previa-ocorrencia-visita",userId,clienteId,planoId,versaoId,rotinaId,serieId,periodo],gcTime:0,enabled:!!periodo,initialPageParam:null as string|null,
    queryFn:async({pageParam,signal}) => {await conferirSessaoDiagnostico(userId,signal);if(!periodo)throw new Error("Período ausente.");const {data,error}=await supabase.schema("pcm").rpc("sso_prever_visitas_rotina",{
      p_plano_id:planoId,p_versao_id:versaoId,p_rotina_id:rotinaId,p_serie_id:serieId,p_inicio:periodo.inicio,p_fim:periodo.fim,p_apos:pageParam,p_limite:30}).abortSignal(signal);if(error)throw error;
      if(!Array.isArray(data)||data.some((c) => typeof c.visita_id!=="string"||typeof c.vencimento_original!=="string"||typeof c.feriado_declarado!=="boolean"||
        typeof c.vigencia_declarada!=="boolean"||typeof c.ocorrencia_preparada!=="boolean"))throw new Error("Prévia inválida.");await conferirSessaoDiagnostico(userId,signal);return data as Candidato[];},
    getNextPageParam:(pagina) => pagina.length===30 ? pagina.at(-1)?.visita_id : undefined});
  const envio=useMutation({mutationFn:async(p:Pedido) => {await conferirSessaoDiagnostico(userId);if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");if((p.modo??"anterior")!==modo)throw new Error("Fluxo da tentativa mudou; procure suporte.");const {data,error}=await supabase.schema("pcm").rpc(modo==="canonico"?"sso_preparar_visita_canonica":"sso_preparar_ocorrencia_por_visita",{
    p_request_id:p.requestId,p_ocorrencia_id:p.ocorrenciaId,p_plano_id:p.planoId,p_versao_id:p.versaoId,p_rotina_id:p.rotinaId,
    p_visita_id:p.visitaId,p_expected_revision:p.revision,p_fonte_dia_util:p.fonte,...(modo==="canonico"?{p_cliente_id:p.clienteId}:{})});if(error)throw error;
    if(!data||data.requestId!==p.requestId||data.visitaId!==p.visitaId||typeof data.ocorrenciaId!=="string"||(modo==="canonico"?(typeof data.cicloVisitaId!=="string"||data.osCriada!==false||data.tarefaAuvoCriada!==false):data.preparada!==true))throw new Error("Resposta inválida.");const ocorrenciaId=z.string().uuid().parse(data.ocorrenciaId);await conferirSessaoDiagnostico(userId);return {ocorrenciaId,visitaId:p.visitaId,modo:p.modo??"anterior"};},
    onSuccess:async(r,p) => {try{await conferirSessaoDiagnostico(userId);if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");sessionStorage.removeItem(chave);}catch{setMensagem("Registro preparado, mas tentativa não foi removida. Procure suporte.");return;}
      setPedido(null);setConfirmado(null);setResultado(r.modo==="canonico"?{visitaId:r.visitaId,ocorrenciaId:r.ocorrenciaId}:null);setFilaAberta(false);setMensagem("Ocorrência preparada; ainda não incluída na fila e sem OS ou tarefa.");await cache.invalidateQueries({queryKey:["previa-ocorrencia-visita",userId,clienteId,planoId,versaoId,rotinaId,serieId]});},
    onError:async(error,p) => {if(primeira.current&&conflitoPreparacaoVisita(error)){try{await conferirSessaoDiagnostico(userId);if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();sessionStorage.removeItem(chave);setPedido(null);setConfirmado(null);setMensagem("A revisão mudou. Atualize e confira novamente.");return;}catch{setMensagem("Tentativa preservada; procure suporte.");return;}}setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte.");},onSettled:() => {trava.current=false;primeira.current=false;}});
  const enviar=(p:Pedido,nova=false) => {if(trava.current)return;trava.current=true;primeira.current=nova;envio.mutate(p);};
  const assinaturaConfirmacao=(c:Candidato) => JSON.stringify([userId,clienteId,planoId,versaoId,rotinaId,serieId,revision,modo,fonte.trim(),c]);
  return <section aria-label="Prévia de ocorrências por Visita"><h5>Prévia por Visita</h5>
    <OrigemGeracaoRotina userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} revision={revision} />
    <p>Visitas regulares identificadas na série. Feriados declarados são incompletos e não oficiais; conferir fonte e vigência antes de preparar. {modo==="canonico"&&"Identidade canônica por série e semana é verificada; registros anteriores podem ser reutilizados."} Nenhuma OS ou tarefa é criada.</p>
    <form onSubmit={(e) => {e.preventDefault();const dias=(Date.parse(`${fim}T00:00:00Z`)-Date.parse(`${inicio}T00:00:00Z`))/86400000;
      if(!Number.isFinite(dias)||dias<0||dias>366){setMensagem("Informe período válido de até 366 dias.");return;}setPeriodo({inicio,fim});}}>
      <label>Início <input required type="date" value={inicio} onChange={(e) => {setInicio(e.target.value);setPeriodo(null);}}/></label>
      <label>Fim <input required type="date" value={fim} onChange={(e) => {setFim(e.target.value);setPeriodo(null);}}/></label><button type="submit">Consultar Visitas</button></form>
    {periodo&&candidatos.isFetching&&<output>Carregando Visitas…</output>}{periodo&&candidatos.isError&&<p role="alert">Prévia indisponível. <button type="button" onClick={() => void candidatos.refetch()}>Tentar novamente</button></p>}
    {periodo&&!candidatos.isFetching&&!candidatos.isError&&<ul>{candidatos.data?.pages.flat().map((c) => <li key={c.visita_id}>
      Visita {c.visita_id} · semana {c.semana_origem} · vencimento {c.vencimento_original} · {c.estado_visita} · {c.feriado_declarado?"feriado declarado":"feriado não comprovado"} · {c.vigencia_declarada?"vigência declarada":"sem vigência"} · {c.ocorrencia_preparada?"já preparada":"não preparada"}
      {!c.feriado_declarado&&c.vigencia_declarada&&(!c.ocorrencia_preparada||modo==="canonico")&&<button type="button" onClick={() => {setSelecionado(c.visita_id);setConfirmado(null);}}>Conferir preparação</button>}
      {selecionado===c.visita_id&&import.meta.env.VITE_SSO_ORIGEM_EFETIVA_CICLO_ENABLED==="true"&&<ConferenciaPmocCiclo key={c.visita_id} userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} revision={revision} vencimento={c.vencimento_original} />}
      {selecionado===c.visita_id&&!c.feriado_declarado&&c.vigencia_declarada&&(!c.ocorrencia_preparada||modo==="canonico")&&<form onSubmit={(event) => {event.preventDefault();if(pedido||trava.current||confirmado!==assinaturaConfirmacao(c)||!fonte.trim()||candidatos.isFetching||candidatos.isError)return;
        const p:Pedido={requestId:crypto.randomUUID(),ocorrenciaId:crypto.randomUUID(),clienteId,planoId,versaoId,rotinaId,visitaId:c.visita_id,revision,fonte:fonte.trim(),modo};
        try{if(sessionStorage.getItem(chave)!==null){setMensagem("Há tentativa anterior; reabra para recuperar.");return;}sessionStorage.setItem(chave,JSON.stringify(p));}
        catch{setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}setPedido(p);enviar(p,true);
      }}><fieldset disabled={!!pedido||envio.isPending}><label>Fonte consultada para declarar dia sem feriado <input required maxLength={500} value={fonte} onChange={(e) => {setFonte(e.target.value);setConfirmado(null);}}/></label>
        <label><input type="checkbox" checked={confirmado===assinaturaConfirmacao(c)} onChange={(e) => setConfirmado(e.target.checked ? assinaturaConfirmacao(c) : null)}/> Confirmei Visita, semana, vigência e fonte declarada</label><button type="submit" disabled={confirmado!==assinaturaConfirmacao(c)}>Preparar ocorrência sem envio</button></fieldset></form>}
    </li>)}</ul>}
    {candidatos.hasNextPage&&<button type="button" onClick={() => void candidatos.fetchNextPage()}>Mais Visitas</button>}
    {periodo && !candidatos.isError && import.meta.env.VITE_SSO_LOTE_VISITA_CANONICA_ENABLED === "true" && <LoteOcorrenciasVisita userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} serieId={serieId} revision={revision} candidatos={candidatos.data?.pages.flat() ?? []} consultando={candidatos.isFetching} />}
    {resultado && <section aria-label="Próximo passo da Visita preparada"><p>Visita {resultado.visitaId} · ocorrência preparada {resultado.ocorrenciaId}.</p>{import.meta.env.VITE_SSO_FILA_VISITA_ENABLED === "true" && <button type="button" aria-expanded={filaAberta} onClick={() => setFilaAberta((aberta) => !aberta)}>{filaAberta ? "Ocultar fila da Visita" : "Conferir inclusão na fila"}</button>}{filaAberta && <FilaPreventivaPcm userId={userId} clienteId={clienteId} planoId={planoId} preparadaId={resultado.ocorrenciaId} tipo="visita" />}<IntegrarOrigemOcorrencia userId={userId} clienteId={clienteId} planoId={planoId} revision={revision} preparadaId={resultado.ocorrenciaId} tipo="visita" /></section>}
    {pedido==="invalido"&&<p role="alert">Tentativa ilegível. Procure suporte.</p>}{pedido&&pedido!=="invalido"&&<button type="button" disabled={envio.isPending} onClick={() => enviar(pedido)}>Repetir mesmo pedido</button>}{mensagem&&<p role="status">{mensagem}</p>}
  </section>;
}
