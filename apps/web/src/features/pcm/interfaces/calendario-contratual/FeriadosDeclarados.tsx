import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { ContratoCalendario, RegraContratualResumo } from "../../application/calendario-contratual-gateway";
import { ImpactosFeriado } from "./ImpactosFeriado";
import { CoincidenciasCalendario } from "./CoincidenciasCalendario";
import { SupressoesFeriado } from "./SupressoesFeriado";
import { RegistrarSupressao } from "./RegistrarSupressao";
import { HistoricoSupressaoGerador } from "./HistoricoSupressaoGerador";

type Feriado={id:string;contrato_id:string|null;data:string;fonte:string;motivo:string;ativo:boolean;revisao:number};
type Pedido={requestId:string;clienteId:string;id:string;revision:number;acao:"declarar"|"retirar";contratoId:string|null;data:string|null;fonte:string|null;motivo:string};
type Props={userId:string;clienteId:string;contratos:ContratoCalendario[];regras?:RegraContratualResumo[];onUsar:(contratoId:string|null,datas:string[],periodo?:{inicio:string;fim:string})=>void};
type Periodo={inicio:string;fim:string;contrato:string|null};
type Cursor={apos:string|null;assinatura:string|null;total:number|null;lidas:number};
type Pagina={itens:Feriado[];assinatura:string|null;total:number|null};
const feriadoSchema=z.object({id:z.string().uuid(),contrato_id:z.string().uuid().nullable(),data:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),fonte:z.string().min(1).max(500),motivo:z.string().min(1).max(2000),ativo:z.boolean(),revisao:z.number().int().positive()}).strict();
export function FeriadosDeclarados(props:Props) {
  return <ConteudoFeriados key={JSON.stringify([props.userId,props.clienteId])} {...props}/>;
}
function ConteudoFeriados({userId,clienteId,contratos,regras=[],onUsar}:Props) {
  const chave=`sso-feriado-declarado:${JSON.stringify([userId,clienteId])}`;const cache=useQueryClient();const trava=useRef(false);
  const [contrato,setContrato]=useState("");const [inicio,setInicio]=useState("");const [fim,setFim]=useState("");const [data,setData]=useState("");
  const [fonte,setFonte]=useState("");const [motivo,setMotivo]=useState("");const [retirada,setRetirada]=useState("");const [mensagem,setMensagem]=useState("");
  const [pedido,setPedido]=useState<Pedido|"invalido"|null>(() => {try{const salvo=sessionStorage.getItem(chave);if(!salvo)return null;const p=JSON.parse(salvo) as Pedido;
    return p&&p.clienteId===clienteId&&typeof p.requestId==="string"&&typeof p.id==="string"&&Number.isSafeInteger(p.revision)&&["declarar","retirar"].includes(p.acao)&&typeof p.motivo==="string" ? p : "invalido";}catch{return "invalido";}});
  const [periodo,setPeriodo]=useState<{inicio:string;fim:string;contrato:string|null}|null>(null);
  const [verificando,setVerificando]=useState(false);const travaConferencia=useRef(false);
  const montado=useRef(false);useEffect(()=>{montado.current=true;return()=>{montado.current=false;};},[]);
  const fotografia=import.meta.env.VITE_SSO_FOTOGRAFIA_FERIADOS_ENABLED==="true";
  async function lerPagina(p:Periodo,c:Cursor,signal?:AbortSignal):Promise<Pagina>{
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal?.aborted)throw new Error("Sessão alterada.");
    const parametros={p_cliente_id:clienteId,p_contrato_id:p.contrato,p_inicio:p.inicio,p_fim:p.fim,p_apos:c.apos,p_limite:50};
    let query=fotografia ? supabase.schema("pcm").rpc("sso_fotografia_feriados",{...parametros,p_ator_id:userId}) : supabase.schema("pcm").rpc("sso_listar_feriados_declarados",parametros);
    if(signal)query=query.abortSignal(signal);const {data:rows,error}=await query;if(error)throw error;
    let pagina:Pagina;
    if(fotografia){const r=z.object({clienteId:z.string().uuid(),contratoId:z.string().uuid().nullable(),inicio:z.string(),fim:z.string(),total:z.number().int().nonnegative().max(2000),assinatura:z.string().regex(/^[a-f0-9]{32}$/),itens:z.array(feriadoSchema).max(50)}).strict().parse(rows);
      if(r.clienteId!==clienteId||r.contratoId!==p.contrato||r.inicio!==p.inicio||r.fim!==p.fim||(c.assinatura!==null&&(r.assinatura!==c.assinatura||r.total!==c.total))||c.lidas+r.itens.length>r.total||(r.itens.length<50&&c.lidas+r.itens.length!==r.total))throw new Error("Fotografia de feriados alterada.");
      pagina={itens:r.itens,assinatura:r.assinatura,total:r.total};
    }else pagina={itens:z.array(feriadoSchema).max(50).parse(rows),assinatura:null,total:null};
    let anterior=c.apos?.toLowerCase()??null;for(const f of pagina.itens){const id=f.id.toLowerCase();if((anterior!==null&&id<=anterior)||f.data<p.inicio||f.data>p.fim||(f.contrato_id!==null&&f.contrato_id!==p.contrato))throw new Error("Página de feriados inconsistente.");anterior=id;}
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal?.aborted)throw new Error("Sessão alterada.");return pagina;
  }
  const inicial:Cursor={apos:null,assinatura:null,total:null,lidas:0};
  function proxima(p:Pagina,c:Cursor):Cursor|undefined{const lidas=c.lidas+p.itens.length;if(p.itens.length===0 || (p.total!==null ? lidas>=p.total : p.itens.length<50))return undefined;return {apos:p.itens[p.itens.length-1]!.id,assinatura:p.assinatura,total:p.total,lidas};}
  const feriados=useInfiniteQuery({queryKey:["feriados-declarados",userId,clienteId,periodo,fotografia],gcTime:0,enabled:!!periodo,initialPageParam:inicial,
    queryFn:({pageParam,signal})=>{if(!periodo)throw new Error("Período ausente.");return lerPagina(periodo,pageParam,signal);},
    getNextPageParam:(pagina,_paginas,parametro)=>proxima(pagina,parametro)});
  const contextoConferencia=useRef({periodo:"",dados:"",disponivel:false});
  contextoConferencia.current={periodo:JSON.stringify(periodo),dados:JSON.stringify(feriados.data?.pages??[]),disponivel:!!periodo&&!!feriados.data&&!feriados.isFetching&&!feriados.isError&&!feriados.hasNextPage};
  async function usarDatasConferidas(){
    if(travaConferencia.current||!periodo||!feriados.data||!contextoConferencia.current.disponivel)return;
    const periodoConsultado={...periodo};const periodoAssinatura=JSON.stringify(periodoConsultado);const paginasExibidas=JSON.stringify(feriados.data.pages);
    travaConferencia.current=true;setVerificando(true);setMensagem("");
    try{
      let cursor:Cursor=inicial;const paginas:Pagina[]=[];
      for(let indice=0;indice<100;indice++){
        const pagina=await lerPagina(periodoConsultado,cursor);paginas.push(pagina);const seguinte=proxima(pagina,cursor);if(!seguinte)break;cursor=seguinte;
        if(indice===99)throw new Error("Limite de páginas excedido.");
      }
      if(!montado.current||JSON.stringify(paginas)!==paginasExibidas||!contextoConferencia.current.disponivel||contextoConferencia.current.periodo!==periodoAssinatura||contextoConferencia.current.dados!==paginasExibidas)throw new Error("Declarações alteradas.");
      onUsar(periodoConsultado.contrato,paginas.flatMap(p=>p.itens).filter(f=>f.ativo).map(f=>f.data),{inicio:periodoConsultado.inicio,fim:periodoConsultado.fim});
    }catch{if(montado.current)setMensagem("Não foi possível reconferir as declarações. Atualize a consulta antes de usar as datas.");}
    finally{travaConferencia.current=false;if(montado.current)setVerificando(false);}
  }
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || !montado.current || sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Sessão ou tentativa alterada.");
      const parametros = {
        p_request_id: p.requestId, p_cliente_id: p.clienteId, p_feriado_id: p.id,
        p_expected_revision: p.revision, p_acao: p.acao, p_contrato_id: p.contratoId,
        p_data: p.data, p_fonte: p.fonte, p_motivo: p.motivo,
      };
      const consulta = import.meta.env.VITE_SSO_DECISAO_FERIADO_MEDIADA_ENABLED === "true"
        ? supabase.schema("pcm").rpc("sso_decidir_feriado_mediado", { ...parametros, p_ator_id: userId })
        : supabase.schema("pcm").rpc("sso_decidir_feriado_declarado", parametros);
      const { data: resultado, error } = await consulta;
      if (error) throw error;
      if (!resultado || resultado.requestId !== p.requestId || resultado.feriadoId !== p.id ||
          resultado.revision !== p.revision + 1 || resultado.ativo !== (p.acao === "declarar"))
        throw new Error("Resposta inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada.");
    },
    onSuccess: async (_resultado, p) => {
      try {
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId || !montado.current || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        if (montado.current) { setPedido("invalido"); setMensagem("Tentativa alterada ou não removida; procure suporte."); }
        return;
      }
      onUsar(null, []);
      void cache.invalidateQueries({ queryKey: ["feriados-declarados", userId, clienteId] });
      setPedido(null);
      setMensagem("Declaração registrada; datas usadas anteriormente na simulação foram limpas. Não houve geração ou alteração de Visitas.");
    },
    onError: () => { if (montado.current) setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); },
    onSettled: () => { trava.current = false; },
  });
  function enviar(p:Pedido,repeticao=false){if(trava.current)return;trava.current=true;try{const salvo=sessionStorage.getItem(chave);if(repeticao?salvo!==JSON.stringify(p):salvo!==null){setPedido("invalido");setMensagem("Tentativa alterada ou não disponível; procure suporte.");trava.current=false;return;}sessionStorage.setItem(chave,JSON.stringify(p));}
    catch{trava.current=false;setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}setPedido(p);envio.mutate(p);}
  return <section aria-label="Feriados declarados"><h3>Feriados declarados</h3>
    <p>Declarações com fonte informada pelo gestor, não verificadas como oficiais. Lista pode estar incompleta; ausência não prova dia útil. Não gera reposição nem Visita.</p>
    <label>Escopo <select value={contrato} disabled={!!pedido} onChange={(e) => {setContrato(e.target.value);setPeriodo(null);}}><option value="">Geral do Cliente</option>
      {contratos.map((c) => <option key={c.id} value={c.id}>Contrato {c.id}</option>)}</select></label>
    <form onSubmit={(event) => {event.preventDefault();if(pedido||!data||!fonte.trim()||!motivo.trim())return;
      enviar({requestId:crypto.randomUUID(),clienteId,id:crypto.randomUUID(),revision:0,acao:"declarar",contratoId:contrato||null,data,fonte:fonte.trim(),motivo:motivo.trim()});}}>
      <fieldset disabled={!!pedido||envio.isPending}><legend>Declarar data</legend>
        <label>Data <input required type="date" value={data} onChange={(e) => setData(e.target.value)}/></label>
        <label>Fonte declarada <input required maxLength={500} value={fonte} onChange={(e) => setFonte(e.target.value)}/></label>
        <label>Motivo <input required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)}/></label><button type="submit">Registrar declaração</button>
      </fieldset></form>
    <form onSubmit={(event) => {event.preventDefault();const dias=(Date.parse(`${fim}T00:00:00Z`)-Date.parse(`${inicio}T00:00:00Z`))/86400000;
      if(!Number.isFinite(dias)||dias<0||dias>366){setMensagem("Informe período válido de até 366 dias de diferença.");return;}setPeriodo({inicio,fim,contrato:contrato||null});}}>
      <label>Início <input required type="date" value={inicio} onChange={(e) => {setInicio(e.target.value);setPeriodo(null);}}/></label>
      <label>Fim <input required type="date" value={fim} onChange={(e) => {setFim(e.target.value);setPeriodo(null);}}/></label><button type="submit">Consultar declarações</button></form>
    {feriados.isFetching&&<output>Carregando declarações…</output>}{feriados.isError&&<p role="alert">Consulta indisponível. <button type="button" onClick={() => void feriados.refetch()}>Tentar novamente</button></p>}
    {periodo&&feriados.data&&!feriados.isFetching&&!feriados.isError&&<><ul>{feriados.data.pages.flatMap(p=>p.itens).map((f) => <li key={f.id}>
      {f.data} · {f.contrato_id ? `contrato ${f.contrato_id}` : "geral"} · fonte {f.fonte} · {f.ativo ? "ativa" : "retirada"}
      <SupressoesFeriado userId={userId} clienteId={clienteId} feriadoId={f.id} />
      <HistoricoSupressaoGerador userId={userId} clienteId={clienteId} feriadoId={f.id} data={f.data} />
      <RegistrarSupressao userId={userId} clienteId={clienteId} feriadoId={f.id} feriadoRevision={f.revisao} data={f.data} contratoId={f.contrato_id} ativo={f.ativo} regras={regras} />
      {f.ativo && <ImpactosFeriado userId={userId} clienteId={clienteId} feriadoId={f.id} data={f.data} />}
      {f.ativo && <CoincidenciasCalendario userId={userId} clienteId={clienteId} feriadoId={f.id} data={f.data} />}
      {f.ativo && <form onSubmit={(event) => {event.preventDefault();if(pedido||!retirada.trim())return;enviar({requestId:crypto.randomUUID(),clienteId,id:f.id,revision:f.revisao,acao:"retirar",contratoId:null,data:null,fonte:null,motivo:retirada.trim()});}}>
        <label>Motivo da retirada <input required maxLength={2000} value={retirada} onChange={(e) => setRetirada(e.target.value)} disabled={!!pedido}/></label><button type="submit" disabled={!!pedido||envio.isPending}>Retirar declaração</button></form>}
    </li>)}</ul>
      <button type="button" disabled={verificando||feriados.hasNextPage||feriados.isFetchingNextPage} onClick={() => void usarDatasConferidas()}>{verificando?"Conferindo declarações…":"Usar datas carregadas na simulação"}</button>
    </>}
    {feriados.hasNextPage&&<button type="button" onClick={() => void feriados.fetchNextPage()}>Mais declarações</button>}
    {pedido==="invalido"&&<p role="alert">Tentativa ilegível. Procure suporte.</p>}{pedido&&pedido!=="invalido"&&<button type="button" disabled={envio.isPending} onClick={() => enviar(pedido,true)}>Repetir mesmo pedido</button>}{mensagem&&<p role="status">{mensagem}</p>}
  </section>;
}
