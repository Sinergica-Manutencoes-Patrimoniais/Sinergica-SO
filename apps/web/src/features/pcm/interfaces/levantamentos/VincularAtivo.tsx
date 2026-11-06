import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { useComponentesDoCliente, useLocaisDoCliente, useSistemasDoCliente } from "../../application/ativos-cliente-queries";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseEquipamentosAdapter } from "../../infrastructure/supabase-equipamentos-adapter";
import { supabaseEstruturaTecnicaAdapter } from "../../infrastructure/supabase-estrutura-tecnica-adapter";
import { supabaseHierarquiaAdapter } from "../../infrastructure/supabase-hierarquia-adapter";
import { supabaseSistemasAdapter } from "../../infrastructure/supabase-sistemas-adapter";
import { AtualizarNome } from "./AtualizarNome";
import { AtualizarGrupo } from "./AtualizarGrupo";
import { AplicarCamposSistema } from "./AplicarCamposSistema";
import { AplicarCamposComponente } from "./AplicarCamposComponente";

const schema=z.object({requestId:z.string().uuid(),loteId:z.string().uuid(),chave:z.string().min(1).max(200),revision:z.number().int().positive(),entidadeId:z.string().uuid(),localId:z.string().uuid(),tipo:z.enum(["sistema","equipamento","componente","grupo_quantitativo"])}).strict();
type Pedido=z.infer<typeof schema>;
type Props={userId:string;clienteId:string;loteId:string;chave:string;revisao:number;tipo:string;atributos?:Record<string,unknown>};
export function VincularAtivo(props:Props){
  if(import.meta.env.VITE_SSO_VINCULO_ATIVO_LEVANTAMENTO_ENABLED!=="true" || !["sistema","equipamento","componente","grupo_quantitativo"].includes(props.tipo))return null;
  return <Permissao key={JSON.stringify([props.userId,props.clienteId,props.loteId,props.chave])} {...props} />;
}
function Permissao(props:Props){
  const p=useQuery({queryKey:["levantamentos",props.userId,props.clienteId,"incorporacao-permissao"],queryFn:()=>supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar",props.clienteId),gcTime:0,refetchOnWindowFocus:true});
  if(p.isPending || p.isFetching)return <output>Verificando permissão de vínculo…</output>;
  if(p.isError)return <p role="alert">Não foi possível verificar acesso. <button type="button" onClick={()=>void p.refetch()}>Tentar novamente</button></p>;
  return p.data===true ? <Conteudo {...props} /> : null;
}
function Conteudo({userId,clienteId,loteId,chave,revisao,tipo,atributos={}}:Props){
  const storageKey=`sso-vinculo-levantamento:${JSON.stringify([userId,clienteId,loteId,chave])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(storageKey);if(!v)return null;const p=schema.parse(JSON.parse(v));return p.loteId===loteId && p.chave===chave && p.tipo===tipo ? p : "invalido";}catch{return "invalido";}});
  const [local,setLocal]=useState("");const [entidade,setEntidade]=useState("");const [confirmado,setConfirmado]=useState<string|null>(null);const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const locais=useLocaisDoCliente(supabaseHierarquiaAdapter,clienteId);const sistemas=useSistemasDoCliente(supabaseSistemasAdapter,clienteId);const equipamentos=useComponentesDoCliente(supabaseEquipamentosAdapter,clienteId);
  const grupos=useInfiniteQuery({queryKey:["levantamentos",userId,clienteId,"grupos-vinculo"],enabled:tipo==="grupo_quantitativo",gcTime:0,initialPageParam:0,
    queryFn:({pageParam,signal})=>supabaseEstruturaTecnicaAdapter.listarGrupos(clienteId,pageParam,20,signal),getNextPageParam:(pagina,paginas)=>pagina.length===20 ? paginas.length*20 : undefined});
  const pronto=!locais.isPending && !locais.isFetching && !locais.isError && !sistemas.isPending && !sistemas.isFetching && !sistemas.isError && !equipamentos.isPending && !equipamentos.isFetching && !equipamentos.isError && (tipo!=="grupo_quantitativo" || (!grupos.isPending && !grupos.isFetching && !grupos.isError));
  const area=locais.data?.find((l)=>l.id===local && l.ativo)?.areaId;
  const opcoes=tipo==="sistema" ? (sistemas.data ?? []).filter((s)=>s.ativo && s.areaId===area).map((s)=>({id:s.id,nome:s.nome})) : tipo==="grupo_quantitativo" ? (grupos.data?.pages.flat() ?? []).filter((g)=>g.localId===local).map((g)=>({id:g.id,nome:g.nome})) : (equipamentos.data ?? []).filter((e)=>e.ativo && e.tipo===tipo && e.localId===local).map((e)=>({id:e.id,nome:e.nome}));
  const fotografia=pronto && local && opcoes.some(o=>o.id===entidade) ? JSON.stringify([userId,clienteId,loteId,chave,revisao,tipo,atributos,local,locais.data?.find(l=>l.id===local),opcoes.find(o=>o.id===entidade)]) : null;
  async function conferirSessao(){const atual=await supabase.auth.getUser();if(atual.error || atual.data.user?.id!==userId)throw new Error("Sessão alterada");}
  const envio=useMutation({mutationFn:async(p:Pedido)=>{await conferirSessao();if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa alterada");const {data,error}=await supabase.schema("pcm").rpc("sso_vincular_ativo_autorizado",{p_request_id:p.requestId,p_lote_id:p.loteId,p_expected_revision:p.revision,p_chave:p.chave,p_entidade_id:p.entidadeId,p_local_id:p.localId});if(error)throw error;
    const r=z.object({aggregateId:z.string().uuid(),revision:z.number().int(),state:z.literal("pendente"),created:z.literal(false),linkedIds:z.object({entidadeId:z.string().uuid(),tipo:z.string()}).strict(),warnings:z.array(z.string()),requestId:z.string().uuid()}).strict().parse(data);
    if(r.aggregateId!==p.loteId || r.revision!==p.revision+1 || r.requestId!==p.requestId || r.linkedIds.entidadeId!==p.entidadeId || r.linkedIds.tipo!==p.tipo)throw new Error("Resposta divergente");await conferirSessao();if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa alterada");
  },onSuccess:async(_r,p)=>{try{await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId,"lotes"],refetchType:"none"});await conferirSessao();if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(storageKey);}catch{setAviso("Vínculo confirmado; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setConfirmado(null);setAviso("Linha vinculada ao cadastro existente, sem alterá-lo.");void client.refetchQueries({queryKey:["levantamentos",userId,clienteId,"lotes"],type:"active"});},onError:()=>setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(!pronto || !fotografia || confirmado!==fotografia || pendente || trava.current || !opcoes.some((o)=>o.id===entidade))return;try{const p=schema.parse({requestId:crypto.randomUUID(),loteId,chave,revision:revisao,entidadeId:entidade,localId:local,tipo});if(sessionStorage.getItem(storageKey)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(storageKey,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira seleção e sessão. Nada foi enviado.");}}
  return <section aria-label="Vincular cadastro existente"><h4>Vincular cadastro existente</h4><p>Confira classificação, vínculo funcional e possíveis duplicidades; esta ação não atualiza o cadastro.</p>
    {!pronto && <p>Seletores indisponíveis ou em atualização. Confira o acesso e tente novamente.</p>}
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir vínculo</button> : !pendente && <form onSubmit={(e)=>{e.preventDefault();iniciar();}}>
      <label>Local <select required disabled={!pronto} value={local} onChange={(e)=>{setLocal(e.target.value);setEntidade("");}}><option value="">Selecione</option>{locais.data?.filter((l)=>l.ativo).map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
      <label>Cadastro <select required disabled={!pronto || !local} value={entidade} onChange={(e)=>setEntidade(e.target.value)}><option value="">Selecione</option>{opcoes.map((o)=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>
      {tipo==="grupo_quantitativo" && grupos.hasNextPage && <button type="button" disabled={grupos.isFetching} onClick={()=>void grupos.fetchNextPage()}>Mais Grupos</button>}
      <label><input type="checkbox" checked={!!fotografia && confirmado===fotografia} disabled={!fotografia} onChange={(e)=>setConfirmado(e.target.checked?fotografia:null)} /> Conferi Local, classificação, código e vínculo funcional.</label>
      <button type="submit" disabled={!pronto || !fotografia || confirmado!==fotografia || envio.isPending}>Vincular</button></form>}
    {entidade && <AtualizarNome userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} revisao={revisao} entidadeId={entidade} tipo={tipo} />}
    {entidade && tipo === "sistema" && <AplicarCamposSistema userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} revisao={revisao} sistemaId={entidade} atributos={atributos} />}
    {entidade && (tipo === "equipamento" || tipo === "componente") && <AplicarCamposComponente userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} revisao={revisao} entidadeId={entidade} tipo={tipo} atributos={atributos} />}
    {entidade && (tipo === "equipamento" || tipo === "componente") && <AtualizarNome userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} revisao={revisao} entidadeId={entidade} tipo={tipo} observacoes />}
    {tipo === "grupo_quantitativo" && entidade && local && <AtualizarGrupo userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} revisao={revisao} grupoId={entidade} localId={local} atributos={atributos} />}
    {tipo === "grupo_quantitativo" && entidade && local && <AtualizarGrupo userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} revisao={revisao} grupoId={entidade} localId={local} atributos={atributos} motivado />}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
