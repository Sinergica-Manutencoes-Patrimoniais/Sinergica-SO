import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { chamadosOsQueryKeys } from "../../application/chamados-os-queries";

const id=z.string().guid();
const fotoSchema=z.object({clienteId:id,chamadoId:id,revision:z.number().int().safe().positive(),parcelaId:id,propostaId:id,
  propostaSha256:z.string().regex(/^[a-f0-9]{64}$/),osAnteriorId:id,osAtualizadaEm:z.string().datetime({offset:true}),
  descricaoRestante:z.string().min(1).max(4000),minutosRestantes:z.number().int().positive(),execucaoComprovada:z.literal(false)}).strict();
export const pedidoContinuacaoParcelaSchema=z.object({requestId:id,osNovaId:id,ator:id,foto:fotoSchema}).strict();
const pedidoSchema=pedidoContinuacaoParcelaSchema;
type Pedido=z.infer<typeof pedidoSchema>;

export function AprovarContinuacaoParcela({usuario,cliente,chamado,proposta,somenteRecuperacao=false}:{usuario:string;cliente:string;chamado:string;proposta:string;somenteRecuperacao?:boolean}) {
  const chave=`sso-continuacao-parcela:${JSON.stringify([usuario,cliente,chamado,proposta])}`;const cache=useQueryClient();const trava=useRef(false);
  const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const t=sessionStorage.getItem(chave);if(!t)return null;const p=pedidoSchema.parse(JSON.parse(t));
    return p.ator===usuario&&p.foto.clienteId===cliente&&p.foto.chamadoId===chamado&&p.foto.propostaId===proposta?p:"invalido";}catch{return "invalido";}});
  const [confirmacao,setConfirmacao]=useState<string|null>(null);const [ocupado,setOcupado]=useState(false);const [aviso,setAviso]=useState("");
  const consulta=useQuery({queryKey:["continuacao-parcela-conferida",usuario,cliente,chamado,proposta],gcTime:0,retry:false,
    queryFn:async({signal})=>{const a=await supabase.auth.getUser();if(a.error||a.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_continuacao_parcela_conferida",{p_ator_id:usuario,p_cliente_id:cliente,p_chamado_id:chamado,p_proposta_id:proposta}).abortSignal(signal);
      if(error)throw error;const f=fotoSchema.parse(data);if(f.clienteId!==cliente||f.chamadoId!==chamado||f.propostaId!==proposta)throw new Error("Origem divergente.");
      const b=await supabase.auth.getUser();if(b.error||b.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return f;}});
  async function enviar(p:Pedido, somenteConsultar=false){if(trava.current)return;try{
    if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");trava.current=true;setOcupado(true);setAviso("");
    const a=await supabase.auth.getUser();if(a.error||a.data.user?.id!==usuario)throw new Error("Sessão alterada.");
    const {data,error}=await supabase.schema("pcm").rpc(somenteConsultar?"sso_consultar_recibo_continuacao_parcela":"sso_aprovar_continuacao_parcela_conferida",{
      p_ator_id:usuario,p_cliente_id:cliente,p_request_id:p.requestId,p_chamado_id:chamado,p_chamado_revision:p.foto.revision,
      p_parcela_id:p.foto.parcelaId,p_proposta_id:proposta,p_proposta_sha256:p.foto.propostaSha256,p_os_anterior_id:p.foto.osAnteriorId,
      p_os_atualizada_em:p.foto.osAtualizadaEm,p_os_nova_id:p.osNovaId});
    if(error)throw error;const r=z.object({requestId:id,chamadoId:id,parcelaId:id,propostaId:id,osAnteriorId:id,osContinuacaoId:id,
      minutosRestantes:z.number().int().positive(),revision:z.number().int().safe().positive(),execucaoComprovada:z.literal(false),envioAuvo:z.literal(false)}).strict().parse(data);
    if(r.requestId!==p.requestId||r.chamadoId!==chamado||r.parcelaId!==p.foto.parcelaId||r.propostaId!==proposta||r.osAnteriorId!==p.foto.osAnteriorId||r.osContinuacaoId!==p.osNovaId||r.minutosRestantes!==p.foto.minutosRestantes)throw new Error("Recibo divergente.");
    const b=await supabase.auth.getUser();if(b.error||b.data.user?.id!==usuario)throw new Error("Sessão alterada.");
    const c=await supabase.auth.getUser();if(c.error||c.data.user?.id!==usuario||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");
    sessionStorage.removeItem(chave);setPendente(null);setConfirmacao(null);setAviso("OS de continuidade criada. A execução ainda precisa ser comprovada.");
    try { await Promise.all([
      cache.invalidateQueries({queryKey:["gestao-escopo-chamado",usuario,cliente,chamado]}),
      cache.invalidateQueries({queryKey:["continuacao-parcela-conferida",usuario,cliente,chamado,proposta]}),
      cache.invalidateQueries({queryKey:chamadosOsQueryKeys.ordens(usuario,cliente,chamado)}),
      cache.invalidateQueries({queryKey:["s167-resumo-chamados",usuario]}),
      cache.invalidateQueries({queryKey:["s167-quadro-gerencial",usuario,cliente]}),
      cache.invalidateQueries({queryKey:["chamado-painel",usuario,chamado]}),
    ]); }
    catch { setAviso("OS criada, mas a atualização da tela falhou. Recarregue para conferir."); }
  }catch{setAviso(somenteConsultar?"Recibo não confirmado. A tentativa foi preservada; consulte suporte ou repita o mesmo pedido.":"Resultado não confirmado. Repita a mesma tentativa ou consulte suporte.");}finally{trava.current=false;setOcupado(false);}}
  function iniciar(){if(somenteRecuperacao||!consulta.data||consulta.isFetching||consulta.isError||pendente||ocupado||confirmacao!==JSON.stringify(consulta.data))return;try{
    const p=pedidoSchema.parse({requestId:crypto.randomUUID(),osNovaId:crypto.randomUUID(),ator:usuario,foto:consulta.data});
    if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);void enviar(p);
  }catch{setAviso("Não foi possível guardar a tentativa. Nada foi enviado.");}}
  const foto=pendente&&pendente!=="invalido"?pendente.foto:!consulta.isFetching&&!consulta.isError?consulta.data:null;
  return <section aria-label="Conferir continuidade da parcela"><p>Não comprova execução ou parada; não agenda nem envia tarefa ao Auvo.</p>
    {consulta.isFetching&&!pendente&&<output>Consultando continuidade…</output>}{consulta.isError&&!pendente&&<p role="alert">Continuidade indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {foto&&<p>OS anterior {foto.osAnteriorId} · parcela {foto.parcelaId} · {foto.minutosRestantes} minutos restantes · {foto.descricaoRestante}</p>}
    {pendente==="invalido"&&<p role="alert">Tentativa ilegível. Consulte suporte.</p>}
    {somenteRecuperacao&&!pendente&&<p>Nenhuma tentativa disponível nesta aba. Atualize a lista para conferir.</p>}
    {pendente&&pendente!=="invalido"?<>{import.meta.env.VITE_SSO_RECIBO_CONTINUACAO_PARCELA_ENABLED==="true"&&<button type="button" disabled={ocupado} onClick={()=>void enviar(pendente,true)}>Consultar recibo sem criar OS</button>}<button type="button" disabled={ocupado} onClick={()=>void enviar(pendente)}>Repetir mesma tentativa</button></>:!pendente&&!somenteRecuperacao&&foto&&<>
      <label><input type="checkbox" checked={confirmacao===JSON.stringify(foto)} onChange={(e)=>setConfirmacao(e.target.checked?JSON.stringify(foto):null)} /> Conferi a OS anterior e o trabalho restante.</label>
      <button type="button" disabled={confirmacao!==JSON.stringify(foto)||ocupado||consulta.isFetching} onClick={iniciar}>Criar OS de continuidade</button></>}
    {aviso&&<p role="status">{aviso}</p>}
  </section>;
}
