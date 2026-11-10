import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import type { VisitaDetalhe } from "../../application/visitas-gateway";
import { semanaCapacidade } from "../../domain/semana-capacidade";
import { SnapshotCapacidade } from "../capacidade-agenda/SnapshotCapacidade";
import { SimulacaoManual, type SimulacaoDeclarada } from "../capacidade-agenda/SimulacaoManual";
import { converterHorarioLocal } from "./horario-local";

type Pedido = {requestId:string;visitaId:string;clienteId:string;revision:number;acao:"reprogramar"|"cancelar";inicio:string|null;fim:string|null;motivo:string;simulacao?:SimulacaoDeclarada};

function semanaNoFuso(instantaneo: string, fuso: string): string | null {
  try {
    const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instantaneo));
    const campo = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value;
    return semanaCapacidade(`${campo("year")}-${campo("month")}-${campo("day")}`)?.inicio ?? null;
  } catch { return null; }
}

function dataNoFuso(instantaneo: string, fuso: string): string | null {
  try {
    const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instantaneo));
    const campo = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value;
    const data = `${campo("year")}-${campo("month")}-${campo("day")}`;
    return semanaCapacidade(data) ? data : null;
  } catch { return null; }
}

function ComparacaoCapacidade({ userId, clienteId, visita, inicio }: { userId: string; clienteId: string; visita: VisitaDetalhe; inicio: string }) {
  let origem: string | null = null;
  let destino: string | null = null;
  try {
    origem = semanaNoFuso(visita.inicioEm, visita.fuso);
    destino = semanaNoFuso(converterHorarioLocal(inicio), visita.fuso);
  } catch { /* horário ainda incompleto */ }
  if (!origem || !destino) return <p>Informe um horário válido para comparar as semanas.</p>;
  return <section aria-label="Contexto parcial das semanas">
    <h4>Contexto parcial das semanas</h4>
    <p>Consultas independentes, sem simular a transferência nem confirmar saldo, equipe ou disponibilidade. Fuso da Visita: {visita.fuso}.</p>
    <h5>Origem — semana {origem}</h5>
    <SnapshotCapacidade userId={userId} clienteId={clienteId} semana={origem} />
    {destino === origem ? <p>Destino na mesma semana; não há segundo snapshot.</p> : <><h5>Destino — semana {destino}</h5><SnapshotCapacidade userId={userId} clienteId={clienteId} semana={destino} /></>}
  </section>;
}

export function TransicaoVisita({userId,clienteId,visita,bloqueado}:{userId:string;clienteId:string;visita:VisitaDetalhe;bloqueado:boolean}) {
  const chave=`sso-visita-transicao:${JSON.stringify([userId,clienteId,visita.id])}`;
  const [acao,setAcao]=useState<Pedido["acao"]>("reprogramar");const [inicio,setInicio]=useState("");const [fim,setFim]=useState("");const [motivo,setMotivo]=useState("");const [mensagem,setMensagem]=useState("");
  const [simulacao,setSimulacao]=useState<SimulacaoDeclarada|null>(null);const [confirmacao,setConfirmacao]=useState<string|null>(null);
  const exigirSimulacao=import.meta.env.VITE_SSO_SIMULACAO_MANUAL_CAPACIDADE_ENABLED==="true"&&import.meta.env.VITE_SSO_REPROGRAMACAO_ALERTAS_DECLARADOS_ENABLED==="true";
  const enviando = useRef(false);
  const [pedido,setPedido]=useState<Pedido|"invalido"|null>(() => {try {const salvo=sessionStorage.getItem(chave);if(!salvo)return null;
    const p=JSON.parse(salvo) as Pedido;return p && p.visitaId===visita.id && p.clienteId===clienteId && typeof p.requestId==="string" &&
      Number.isSafeInteger(p.revision) && ["reprogramar","cancelar"].includes(p.acao) && typeof p.motivo==="string" &&
      (!p.simulacao || (p.acao==="reprogramar" && typeof p.simulacao.vencimento==="string" && typeof p.simulacao.destino==="string" && (p.simulacao.programada===null||typeof p.simulacao.programada==="string") && Array.isArray(p.simulacao.alertas) && p.simulacao.alertas.every((a)=>typeof a==="string") &&
        (p.simulacao.protocolo===undefined || (p.simulacao.protocolo==="proveniencia" && typeof p.simulacao.origemParcial==="boolean" && typeof p.simulacao.destinoParcial==="boolean")))) ? p : "invalido";}catch{return "invalido";}});
  const capacidade=pedido && pedido!=="invalido" ? pedido.acao : acao;
  const permissao=useQuery({queryKey:["visita-transicao-permissao",userId,clienteId,capacidade],gcTime:0,refetchOnWindowFocus:true,
    queryFn:async ({signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("config").rpc("sso_autorizar_acao",{
      p_acao:capacidade==="cancelar" ? "visita.cancelar" : "visita.confirmar",p_cliente_id:clienteId}).abortSignal(signal);if(error)throw error;
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return data===true;}});
  const cache=useQueryClient();
  const envio=useMutation({mutationFn:async(p:Pedido) => {if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId)throw new Error("Sessão alterada.");
    const parametrosSimulacao=p.simulacao?{p_ator_id:userId,p_cliente_id:p.clienteId,p_request_id:p.requestId,p_visita_id:p.visitaId,p_revision:p.revision,p_inicio:p.inicio,p_fim:p.fim,p_motivo:p.motivo,p_vencimento_declarado:p.simulacao.vencimento,p_alertas:p.simulacao.alertas}:null;
    const requisicao=p.simulacao&&parametrosSimulacao?(p.simulacao.protocolo==="proveniencia"?supabase.schema("pcm").rpc("sso_reprogramar_visita_com_proveniencia",{...parametrosSimulacao,p_origem_parcial:p.simulacao.origemParcial,p_destino_parcial:p.simulacao.destinoParcial}):supabase.schema("pcm").rpc("sso_reprogramar_visita_alertas_declarados",parametrosSimulacao))
      :supabase.schema("pcm").rpc("sso_transicionar_visita_mediada",{p_request_id:p.requestId,p_visita_id:p.visitaId,p_expected_revision:p.revision,p_acao:p.acao,p_inicio:p.inicio,p_fim:p.fim,p_motivo:p.motivo});
    const {data,error}=await requisicao;if(error)throw error;if(!data||data.requestId!==p.requestId||data.aggregateId!==p.visitaId||data.revision!==p.revision+1)throw new Error("Resposta inválida.");
    if(p.simulacao&&(data.clienteId!==p.clienteId||data.vencimentoDeclarado!==p.simulacao.vencimento||JSON.stringify(data.alertasDeclarados)!==JSON.stringify(p.simulacao.alertas)||data.capacidadeComprovada!==false||data.vencimentoComprovado!==false||data.tarefaAuvoAlterada!==false))throw new Error("Resposta divergente.");
    if(p.simulacao?.protocolo==="proveniencia"&&(data.origemParcialDeclarada!==p.simulacao.origemParcial||data.destinoParcialDeclarada!==p.simulacao.destinoParcial||data.provenienciaComprovada!==false))throw new Error("Proveniência divergente.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");},
    onSuccess:async (_resultado, enviada) => {await Promise.all([cache.invalidateQueries({queryKey:["visitas",userId,clienteId]}),cache.invalidateQueries({queryKey:["historico-alertas-reprogramacao",userId,clienteId,visita.id]})]);
      try{const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(enviada)){setMensagem("Transição concluída, mas a sessão mudou ou há outra tentativa local. Reabra para conferi-la.");return;}sessionStorage.removeItem(chave);}catch{setMensagem("Transição concluída, mas tentativa não foi removida. Procure suporte.");return;}
      setPedido(null);setMensagem("Visita atualizada localmente. Nenhuma tarefa remota foi alterada; confira os vínculos.");},
    onError:() => setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."),
    onSettled:() => {enviando.current=false;}});
  const permitido=permissao.data===true&&!permissao.isFetching&&!permissao.isError&&!bloqueado;
  useEffect(()=>{if(!permitido){setSimulacao(null);setConfirmacao(null);}},[permitido]);
  useEffect(()=>{setSimulacao(null);setConfirmacao(null);},[visita.id,visita.revisao,clienteId,userId]);
  let datasSimulacao: { vencimento: string; programada: string; destino: string } | null = null;
  if (acao === "reprogramar" && inicio) {
    try {
      const origem = dataNoFuso(visita.inicioEm, visita.fuso);
      const destino = dataNoFuso(converterHorarioLocal(inicio), visita.fuso);
      // Visita não é a ocorrência: não inventar vencimento original.
      if (origem && destino) datasSimulacao = { vencimento: "", programada: origem, destino };
    } catch { /* horário de destino incompleto */ }
  }
  const simulacaoAtual=!!datasSimulacao&&!!simulacao&&simulacao.programada===datasSimulacao.programada&&simulacao.destino===datasSimulacao.destino;
  const confirmacaoAtual=simulacaoAtual&&confirmacao===JSON.stringify([simulacao,visita.revisao,inicio,fim,motivo]);
  const provenienciaNecessaria = !!simulacao && (simulacao.origemParcial === true || simulacao.destinoParcial === true);
  const provenienciaDisponivel = import.meta.env.VITE_SSO_PROVENIENCIA_SIMULACAO_ENABLED === "true";
  return <section aria-label="Reprogramar ou cancelar Visita"><h4>Reprogramar ou cancelar Visita</h4>
    <p>Somente antes de envio ou efeito remoto identificado. A operação não altera tarefas Auvo nem remove vínculos de OS. Horários informados no fuso do dispositivo; fuso da Visita: {visita.fuso}.</p>
    {permissao.isFetching && <output>Verificando permissão…</output>}{permissao.isError && <p role="alert">Permissão indisponível. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>}
    {!permissao.isFetching&&!permissao.isError&&!permissao.data && <p>Sem permissão para esta ação.</p>}
    <form onSubmit={(event) => {event.preventDefault();if(!permitido||pedido||enviando.current||!motivo.trim()||(exigirSimulacao&&acao==="reprogramar"&&(!confirmacaoAtual||(provenienciaNecessaria&&!provenienciaDisponivel))))return;
      try {const p:Pedido={requestId:crypto.randomUUID(),visitaId:visita.id,clienteId,revision:visita.revisao,acao,
        inicio:acao==="reprogramar" ? converterHorarioLocal(inicio) : null,fim:acao==="reprogramar" ? converterHorarioLocal(fim) : null,motivo:motivo.trim(),...(exigirSimulacao&&acao==="reprogramar"&&simulacao?{simulacao:import.meta.env.VITE_SSO_PROVENIENCIA_SIMULACAO_ENABLED === "true" ? {...simulacao,protocolo:"proveniencia" as const} : simulacao}:{})};
        if(p.inicio&&p.fim&&p.fim<=p.inicio){setMensagem("Fim deve ser posterior ao início.");return;}
        if(sessionStorage.getItem(chave)!==null){setMensagem("Há tentativa anterior; reabra para recuperar.");return;}
        sessionStorage.setItem(chave,JSON.stringify(p));setPedido(p);enviando.current=true;envio.mutate(p);
      }catch{setMensagem("Confira horários e armazenamento. Nada foi enviado.");}
    }}><fieldset disabled={!!pedido||envio.isPending||bloqueado}>
      <label>Ação <select value={acao} onChange={(e) => {setAcao(e.target.value as Pedido["acao"]);setSimulacao(null);setConfirmacao(null);}}><option value="reprogramar">Reprogramar</option><option value="cancelar">Cancelar</option></select></label>
      {acao==="reprogramar" && <><label>Início <input required type="datetime-local" value={inicio} onChange={(e) => {setInicio(e.target.value);setSimulacao(null);setConfirmacao(null);}}/></label>
        <label>Fim <input required type="datetime-local" value={fim} onChange={(e) => {setFim(e.target.value);setConfirmacao(null);}}/></label></>}
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => {setMotivo(e.target.value);setConfirmacao(null);}}/></label>
      {exigirSimulacao&&acao==="reprogramar"&&<label><input type="checkbox" checked={!!confirmacaoAtual} disabled={!simulacaoAtual} onChange={e=>setConfirmacao(e.target.checked?JSON.stringify([simulacao,visita.revisao,inicio,fim,motivo]):null)}/> Conferi a simulação e seus alertas declarados; a justificativa acima registra minha decisão.</label>}
      {exigirSimulacao&&acao==="reprogramar"&&provenienciaNecessaria&&!provenienciaDisponivel&&<p role="alert">A simulação usa subtotais parciais, mas o registro de proveniência está indisponível. Retire os subtotais ou aguarde a liberação segura.</p>}
      <button type="submit" disabled={!permitido||(exigirSimulacao&&acao==="reprogramar"&&(!confirmacaoAtual||(provenienciaNecessaria&&!provenienciaDisponivel)))}>Confirmar transição local</button>
    </fieldset></form>
    {permitido && !pedido && acao === "reprogramar" && inicio && import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_ENABLED === "true" && import.meta.env.VITE_SSO_COMPARACAO_CAPACIDADE_VISITA_ENABLED === "true" && <ComparacaoCapacidade userId={userId} clienteId={clienteId} visita={visita} inicio={inicio} />}
    {permitido && !pedido && datasSimulacao && import.meta.env.VITE_SSO_SIMULACAO_MANUAL_CAPACIDADE_ENABLED === "true" && <>
      <p>Simulação auxiliar: informe o vencimento da ocorrência e confira as datas. {exigirSimulacao?"A confirmação registra os alertas informados, sem comprovar capacidade ou vencimento.":"Seu resultado não é salvo nem valida a reprogramação."}</p>
      <SimulacaoManual key={JSON.stringify([userId, clienteId, visita.id, datasSimulacao.programada, datasSimulacao.destino])} userId={userId} clienteId={clienteId} datasIniciais={datasSimulacao} aoSimular={(s)=>{setSimulacao(s);setConfirmacao(null);}}/>
    </>}
    {pedido==="invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    {pedido&&pedido!=="invalido" && <button type="button" disabled={!permitido||envio.isPending} onClick={() => {if(enviando.current)return;try{if(sessionStorage.getItem(chave)!==JSON.stringify(pedido)){setMensagem("Tentativa local alterada. Reabra para conferi-la antes de repetir.");return;}}catch{setMensagem("Não foi possível conferir a tentativa; nada foi enviado.");return;}enviando.current=true;envio.mutate(pedido);}}>Repetir mesmo pedido</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
