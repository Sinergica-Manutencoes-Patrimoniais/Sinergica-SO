import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { prepararConferenciaFaturavel } from "../../domain/faturaveis";

const uuid=z.string().uuid();
const pedidoSchema=z.object({requestId:uuid,clienteId:uuid,itemId:uuid,fatoId:uuid,revision:z.number().int().positive().safe(),atestacaoRevision:z.number().int().positive().safe(),valorCentavos:z.number().int().nonnegative().safe(),motivo:z.string().max(2000).nullable()}).strict();
const atestacao=z.object({clienteId:uuid,fatoId:uuid,revision:z.number().int().nonnegative().safe(),estado:z.enum(["confirmada","retirada"]).nullable(),revisaoPcmId:uuid,revisaoPcmAtual:z.boolean(),execucaoFisicaComprovada:z.literal(false),exclusividadeComprovada:z.literal(false),geraFaturavel:z.literal(false)}).strict();
type Pedido=z.infer<typeof pedidoSchema>;
type Props={usuario:string;cliente:string;itemId:string;fatoId:string;revision:number;valorOriginal:number;status:string;onRecuperado?:()=>void};

export function possuiTentativaConferenciaServico(usuario:string,cliente:string,itemId:string){
  try{return sessionStorage.getItem(`sso-conferir-servico:${JSON.stringify([usuario,cliente,itemId])}`)!==null;}catch{return true;}
}

/** Recupera pedidos da aba mesmo quando os filtros ocultam o item da fila. */
export function RecuperarConferenciasServico({usuario,cliente,itensVisiveis}:{usuario:string;cliente:string;itensVisiveis:string[]}){
  const [pedidos,setPedidos]=useState<Pedido[]>([]);
  const [erro,setErro]=useState("");
  const [aviso,setAviso]=useState("");
  function procurar(){
    try{
      const encontrados:Pedido[]=[];
      for(let i=0;i<sessionStorage.length;i++){
        const chave=sessionStorage.key(i);
        if(!chave?.startsWith("sso-conferir-servico:"))continue;
        let identidade:unknown;
        try{identidade=JSON.parse(chave.slice("sso-conferir-servico:".length));}catch{continue;}
        if(!Array.isArray(identidade)||identidade.length!==3||identidade[0]!==usuario||identidade[1]!==cliente)continue;
        const raw=sessionStorage.getItem(chave);if(!raw)continue;
        const pedido=pedidoSchema.parse(JSON.parse(raw));
        if(pedido.clienteId!==cliente||pedido.itemId!==identidade[2])throw new Error("Identidade divergente.");
        encontrados.push(pedido);
      }
      setPedidos(encontrados);setErro("");setAviso(encontrados.length?`${encontrados.length} tentativa(s) encontrada(s) nesta aba.`:"Nenhuma tentativa encontrada nesta aba.");
    }catch{setPedidos([]);setErro("Não foi possível ler as tentativas desta aba. Procure suporte.");}
  }
  if(import.meta.env.VITE_SSO_CONFERENCIA_CANDIDATO_SERVICO_ENABLED!=="true")return null;
  return <section aria-label="Recuperar conferências de serviço"><button type="button" onClick={procurar}>Procurar conferências pendentes nesta aba</button>
    {erro&&<p role="alert">{erro}</p>}{aviso&&<p role="status">{aviso}</p>}
    {pedidos.filter(p=>!itensVisiveis.includes(p.itemId)).map(p=><div key={p.requestId}><p>Item {p.itemId}, fora da lista exibida.</p><ConferirServico usuario={usuario} cliente={cliente} itemId={p.itemId} fatoId={p.fatoId} revision={p.revision} valorOriginal={p.valorCentavos} status="recuperacao" onRecuperado={()=>{setPedidos(atuais=>atuais.filter(item=>item.requestId!==p.requestId));setAviso(`Conferência do item ${p.itemId} confirmada. Nenhuma cobrança foi criada.`);}} /></div>)}
  </section>;
}

export function ConferirServico(props:Props){
  if(import.meta.env.VITE_SSO_CONFERENCIA_CANDIDATO_SERVICO_ENABLED!=="true")return null;
  return <Conteudo key={JSON.stringify([props.usuario,props.cliente,props.itemId,props.fatoId])} {...props}/>;
}
function Conteudo({usuario,cliente,itemId,fatoId,revision,valorOriginal,status,onRecuperado}:Props){
  const chave=`sso-conferir-servico:${JSON.stringify([usuario,cliente,itemId])}`;const cache=useQueryClient();const trava=useRef(false);
  const [valor,setValor]=useState(String(valorOriginal));const [motivo,setMotivo]=useState("");const [confirmacao,setConfirmacao]=useState<string|null>(null);const [ocupado,setOcupado]=useState(false);const [aviso,setAviso]=useState("");
  const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const raw=sessionStorage.getItem(chave);if(!raw)return null;const p=pedidoSchema.parse(JSON.parse(raw));return p.clienteId===cliente&&p.itemId===itemId&&p.fatoId===fatoId?p:"invalido";}catch{return "invalido";}});
  async function sessao(signal?:AbortSignal){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==usuario||signal?.aborted)throw new Error("Sessão alterada.");}
  const consulta=useQuery({queryKey:["faturavel-servico-atestacao",usuario,cliente,fatoId],enabled:!pendente&&status==="pendente",gcTime:0,retry:false,queryFn:async({signal})=>{
    await sessao(signal);const {data,error}=await supabase.schema("financeiro").rpc("sso_consultar_atestacao_servico",{p_cliente_id:cliente,p_fato_id:fatoId}).abortSignal(signal);
    if(error)throw error;const r=atestacao.parse(data);if(r.clienteId!==cliente||r.fatoId!==fatoId)throw new Error("Origem divergente.");await sessao(signal);return r;
  }});
  const atual=!consulta.isFetching&&!consulta.isError?consulta.data:undefined;
  const numero=/^\d+$/.test(valor)?Number(valor):NaN;
  const elegivel=status==="pendente"&&!!atual&&atual.estado==="confirmada"&&atual.revisaoPcmAtual&&atual.revision>0&&Number.isSafeInteger(numero)&&numero>=0;
  const foto=JSON.stringify([usuario,cliente,itemId,fatoId,revision,valorOriginal,atual,valor,motivo.trim()]);
  async function enviar(p:Pedido){
    if(trava.current)return;trava.current=true;setOcupado(true);setAviso("");
    try{
      await sessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");
      const {data,error}=await supabase.schema("financeiro").rpc("sso_conferir_candidato_servico",{p_request_id:p.requestId,p_cliente_id:p.clienteId,p_item_id:p.itemId,p_expected_revision:p.revision,p_atestacao_revision:p.atestacaoRevision,p_valor_centavos:p.valorCentavos,p_motivo:p.motivo});
      if(error)throw error;const r=z.object({aggregateId:uuid,revision:z.number().int().positive().safe(),state:z.literal("conferido"),created:z.literal(false),linkedIds:z.object({}).strict(),warnings:z.array(z.string()),requestId:uuid}).strict().parse(data);
      if(r.requestId!==p.requestId||r.aggregateId!==p.itemId||r.revision!==p.revision+1)throw new Error("Recibo divergente.");
      await sessao();await cache.invalidateQueries({queryKey:["faturaveis",usuario,cliente],refetchType:"none"});await sessao();
      if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");sessionStorage.removeItem(chave);setPendente(null);setConfirmacao(null);setAviso("Serviço conferido. Nenhuma cobrança foi criada.");void cache.refetchQueries({queryKey:["faturaveis",usuario,cliente],type:"active"});onRecuperado?.();
    }catch{setAviso("Resultado não confirmado. Repita a mesma tentativa ou procure suporte.");}finally{trava.current=false;setOcupado(false);}
  }
  function iniciar(){
    if(!atual||!elegivel||pendente||ocupado||confirmacao!==foto)return;
    try{prepararConferenciaFaturavel(valorOriginal,numero,motivo);const p=pedidoSchema.parse({requestId:crypto.randomUUID(),clienteId:cliente,itemId,fatoId,revision,atestacaoRevision:atual.revision,valorCentavos:numero,motivo:motivo.trim()||null});if(sessionStorage.getItem(chave)!==null)throw new Error("Tentativa existente.");sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);void enviar(p);}catch{setAviso("Confira o valor e informe motivo para qualquer ajuste.");}
  }
  return <section aria-label="Conferir serviço extra"><h5>Conferir serviço</h5><p>A conferência verifica a origem e não cria cobrança. Informe valores em centavos.</p>
    {consulta.isError&&<p role="alert">Atestação indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {atual&&!elegivel&&<p>Atestação atual e valor válido são necessários.</p>}
    {pendente==="invalido"?<p role="alert">Tentativa ilegível. Procure suporte.</p>:pendente?<button type="button" disabled={ocupado} onClick={()=>void enviar(pendente)}>Repetir tentativa</button>:<>
      <label>Valor conferido em centavos <input inputMode="numeric" value={valor} disabled={ocupado} onChange={e=>{setValor(e.target.value);setConfirmacao(null);}}/></label>
      <label>Motivo do ajuste <textarea maxLength={2000} value={motivo} disabled={ocupado} onChange={e=>{setMotivo(e.target.value);setConfirmacao(null);}}/></label>
      <label><input type="checkbox" checked={confirmacao===foto} disabled={!elegivel||ocupado} onChange={e=>setConfirmacao(e.target.checked?foto:null)}/> Conferi a origem, a atestação e o valor.</label>
      <button type="button" disabled={!elegivel||ocupado||confirmacao!==foto} onClick={iniciar}>Conferir serviço</button></>}
    {aviso&&<p role="status">{aviso}</p>}
  </section>;
}
