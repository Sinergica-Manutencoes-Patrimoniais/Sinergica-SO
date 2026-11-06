import { useInfiniteQuery,useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Item={id:string;os_id:string;tarefa_auvo_id:string;estado:string;revisao:number};
const pedidoSchema=z.object({requestId:z.string().uuid(),eventoId:z.string().uuid(),clienteId:z.string().uuid(),intencaoId:z.string().uuid(),revision:z.number().int().positive().safe(),acao:z.enum(["anotar","descartar"]),resultado:z.enum(["desconhecido","mesma_tarefa","divergente"]).nullable(),tarefa:z.string().max(100).nullable(),referencia:z.string().max(500).nullable(),motivo:z.string().trim().min(1).max(2000)}).strict()
  .refine(p=>p.acao==="anotar"?p.resultado!==null&&!!p.referencia?.trim():p.resultado===null&&p.tarefa===null&&p.referencia===null);
type Pedido=z.infer<typeof pedidoSchema>;
type Props = {userId:string;clienteId:string};
const origemSchema=z.object({intencaoId:z.string().uuid(),osId:z.string().uuid(),origem:z.object({listaId:z.string().uuid(),eventoRevisao:z.number().int().min(2),registradoEm:z.string().datetime({offset:true}),motivo:z.string().min(1).max(50),descricao:z.string().min(1).max(4000)}).strict().nullable(),excecaoAtualComprovada:z.literal(false).optional()}).strict();
export function TriagemIntencoes(props: Props) {
  return <TriagemIntencoesInterna key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function TriagemIntencoesInterna({userId,clienteId}: Props) {
  const chave=`sso-triagem-intencao-os:${JSON.stringify([userId,clienteId])}`;const cache=useQueryClient();
  const trava=useRef(false);
  const [selecionado,setSelecionado]=useState("");const [acao,setAcao]=useState<Pedido["acao"]>("anotar");const [resultado,setResultado]=useState<NonNullable<Pedido["resultado"]>>("desconhecido");
  const [tarefa,setTarefa]=useState("");const [referencia,setReferencia]=useState("");const [motivo,setMotivo]=useState("");const [mensagem,setMensagem]=useState("");const [confirmacao,setConfirmacao]=useState<string|null>(null);
  const [pedido,setPedido]=useState<Pedido|"invalido"|null>(() => {try{const valor=sessionStorage.getItem(chave);if(!valor)return null;const p=pedidoSchema.parse(JSON.parse(valor));
    return p.clienteId===clienteId ? p : "invalido";}catch{return "invalido";}});
  const itens=useInfiniteQuery({queryKey:["triagem-intencao-os",userId,clienteId],gcTime:0,initialPageParam:null as string|null,
    queryFn:async({pageParam,signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_listar_intencoes_triagem_mediada",{
      p_cliente_id:clienteId,p_apos:pageParam,p_limite:30}).abortSignal(signal);if(error)throw error;
      const pagina=z.array(z.object({id:z.string().uuid(),os_id:z.string().uuid(),tarefa_auvo_id:z.string().min(1),estado:z.string(),revisao:z.number().int().positive().safe()}).passthrough()).max(30).parse(data);let anterior=pageParam?.toLowerCase()??"";for(const linha of pagina){const id=linha.id.toLowerCase();if(id<=anterior)throw new Error("Página divergente.");anterior=id;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return pagina as Item[];},getNextPageParam:(pagina) => pagina.length===30 ? pagina.at(-1)?.id : undefined});
  const historico=useInfiniteQuery({queryKey:["historico-triagem-intencao",userId,clienteId,selecionado],gcTime:0,enabled:!!selecionado,initialPageParam:null as number|null,
    queryFn:async({pageParam,signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_listar_triagens_mediada",{
      p_cliente_id:clienteId,p_intencao_id:selecionado,p_apos:pageParam,p_limite:30}).abortSignal(signal);if(error)throw error;
      const pagina=z.array(z.object({id:z.string().uuid(),revisao:z.number().int().positive().safe(),acao:z.enum(["anotar","descartar"]),resultado_declarado:z.string().nullable(),ator_id:z.string().uuid(),criado_em:z.string()}).strict()).max(30).parse(data);let anterior=pageParam??0;for(const linha of pagina){if(linha.revisao<=anterior)throw new Error("Página divergente.");anterior=linha.revisao;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return pagina;},
    getNextPageParam:(pagina) => pagina.length===30 ? pagina.at(-1)?.revisao : undefined});
  const itemAtual=itens.data?.pages.flat().find((i)=>i.id===selecionado);
  const fotografia=JSON.stringify({userId,clienteId,item:itemAtual??null,acao,resultado,tarefa,referencia,motivo});
  const origemMaterial=useQuery({queryKey:["triagem-intencao-os",userId,clienteId,"material",selecionado,itemAtual?.os_id],gcTime:0,
    enabled:import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&!!itemAtual&&!itens.isFetching&&!itens.isError,
    queryFn:async({signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted||!itemAtual)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_origem_material_intencao",{p_cliente_id:clienteId,p_intencao_id:itemAtual.id}).abortSignal(signal);if(error)throw error;
      const r=origemSchema.parse(data);if(r.intencaoId!==itemAtual.id||r.osId!==itemAtual.os_id)throw new Error("Origem divergente.");
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return r;}});
  const envio=useMutation({mutationFn:async(p:Pedido) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_triagem_intencao_mediada",{
    p_request_id:p.requestId,p_evento_id:p.eventoId,p_intencao_id:p.intencaoId,p_expected_revision:p.revision,p_acao:p.acao,
    p_resultado:p.resultado,p_tarefa:p.tarefa,p_referencia:p.referencia,p_motivo:p.motivo});if(error)throw error;
    if(!data||data.requestId!==p.requestId||data.intencaoId!==p.intencaoId||data.revision!==p.revision+1||data.efeitoRemoto!==false)throw new Error("Resposta inválida.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");},
    onSuccess:async(_resultado,p) => {await cache.invalidateQueries({queryKey:["triagem-intencao-os",userId,clienteId]});await cache.invalidateQueries({queryKey:["historico-triagem-intencao",userId,clienteId]});
      try{const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p)){setMensagem("Triagem registrada, mas sessão ou tentativa local mudou. Reabra para conferi-la.");return;}sessionStorage.removeItem(chave);}catch{setMensagem("Triagem registrada, mas tentativa não foi removida. Procure suporte.");return;}
      setPedido(null);setConfirmacao(null);setMensagem("Triagem interna registrada; nenhuma conciliação remota foi comprovada.");},
    onError:() => setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."),onSettled:() => {trava.current=false;}});
  const enviar=(p:Pedido) => {if(trava.current)return;
    try{if(sessionStorage.getItem(chave)!==JSON.stringify(p)){setMensagem("Tentativa local alterada. Reabra para conferi-la.");return;}}
    catch{setMensagem("Não foi possível conferir tentativa; nada foi enviado.");return;}
    trava.current=true;envio.mutate(p);};
  return <section aria-label="Triagem manual de intenção"><h4>Triagem manual de intenção</h4>
    <p>Declarações não comprovam conciliação remota e não movem a OS. Não inclua credenciais na referência.</p>
    {itens.isFetching&&<output>Carregando intenções…</output>}{itens.isError&&<p role="alert">Triagem indisponível ou sem permissão. <button type="button" onClick={() => void itens.refetch()}>Tentar novamente</button></p>}
    {!itens.isFetching&&!itens.isError&&<ul>{itens.data?.pages.flat().map((i) => <li key={i.id}>OS {i.os_id} · tarefa {i.tarefa_auvo_id} · {i.estado} · revisão {i.revisao}
      <button type="button" onClick={() => setSelecionado(i.id)}>Ver triagem</button>
      {selecionado===i.id&&<>
        {import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&<section aria-label="Material associado à intenção">
          {origemMaterial.isFetching&&<output>Consultando origem de material…</output>}
          {origemMaterial.isError&&<p role="alert">Origem de material indisponível ou sem permissão. <button type="button" onClick={()=>void origemMaterial.refetch()}>Tentar novamente</button></p>}
          {!origemMaterial.isFetching&&!origemMaterial.isError&&origemMaterial.data&&(origemMaterial.data.origem?<p>Exceção histórica: {origemMaterial.data.origem.motivo} · {origemMaterial.data.origem.descricao}. Não confirma que permanece aberta.</p>:<p>Sem origem de material associada.</p>)}
        </section>}
        {historico.isFetching&&<output>Carregando histórico…</output>}{historico.isError&&<p role="alert">Histórico indisponível. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
        {!historico.isFetching&&!historico.isError&&<ul>{historico.data?.pages.flat().map((e) => <li key={e.id}>Revisão {e.revisao} · {e.acao} · {e.resultado_declarado??"sem resultado"} · {e.ator_id} · {e.criado_em}</li>)}</ul>}
        {historico.hasNextPage&&<button type="button" onClick={() => void historico.fetchNextPage()}>Mais eventos</button>}
      </>}
      {selecionado===i.id&&i.estado==="pendente"&&<form onSubmit={(event) => {event.preventDefault();if(pedido||trava.current||confirmacao!==fotografia||!motivo.trim()||(acao==="anotar"&&!referencia.trim())||itens.isFetching||itens.isError)return;
        const validacao=pedidoSchema.safeParse({requestId:crypto.randomUUID(),eventoId:crypto.randomUUID(),clienteId,intencaoId:i.id,revision:i.revisao,acao,
          resultado:acao==="anotar"?resultado:null,tarefa:acao==="anotar"?(tarefa.trim()||null):null,referencia:acao==="anotar"?referencia.trim():null,motivo:motivo.trim()});if(!validacao.success){setMensagem("Confira os dados da triagem.");return;}const p=validacao.data;
        try{if(sessionStorage.getItem(chave)!==null){setMensagem("Há tentativa anterior; reabra para recuperar.");return;}sessionStorage.setItem(chave,JSON.stringify(p));}
        catch{setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}setPedido(p);enviar(p);
      }}><fieldset disabled={!!pedido||envio.isPending}><label>Ação <select value={acao} onChange={(e) => setAcao(e.target.value as Pedido["acao"])}><option value="anotar">Anotar evidência declarada</option><option value="descartar">Descartar intenção interna</option></select></label>
        {acao==="anotar"&&<><label>Resultado declarado <select value={resultado} onChange={(e) => setResultado(e.target.value as NonNullable<Pedido["resultado"]>)}><option value="desconhecido">Desconhecido</option><option value="mesma_tarefa">Mesma tarefa</option><option value="divergente">Divergente</option></select></label>
          <label>ID da tarefa observada <input value={tarefa} maxLength={100} onChange={(e) => setTarefa(e.target.value)}/></label>
          <label>Referência <input required maxLength={500} value={referencia} onChange={(e) => setReferencia(e.target.value)}/></label></>}
        <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)}/></label>
        {confirmacao&&confirmacao!==fotografia&&<p role="alert">Dados ou revisão mudaram; confira novamente.</p>}
        <label><input type="checkbox" checked={confirmacao===fotografia} onChange={(e)=>setConfirmacao(e.target.checked?fotografia:null)}/> Conferi a intenção, a OS e a triagem. Não estou confirmando efeito remoto.</label>
        <button type="submit" disabled={confirmacao!==fotografia}>Registrar triagem</button></fieldset></form>}
    </li>)}</ul>}
    {itens.hasNextPage&&<button type="button" onClick={() => void itens.fetchNextPage()}>Mais intenções</button>}
    {pedido==="invalido"&&<p role="alert">Tentativa ilegível. Procure suporte.</p>}{pedido&&pedido!=="invalido"&&<button type="button" disabled={envio.isPending} onClick={() => enviar(pedido)}>Repetir mesmo pedido</button>}{mensagem&&<p role="status">{mensagem}</p>}
  </section>;
}
