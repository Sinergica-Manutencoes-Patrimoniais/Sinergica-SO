import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { consultarFotografiaEscopoConversao, type PedidoConversaoIntegral } from "../../infrastructure/supabase-conversao-integral-adapter";
import { chamadosOsQueryKeys } from "../../application/chamados-os-queries";
import { prepararAberturaOrdemServico } from "../../application/abrir-ordem-servico";
import type { DadosAberturaOs, EquipamentoAlvoOpcao } from "../../application/ordem-servico-gateway";
import type { Chamado } from "../../domain/chamados";
import type { StatusOrdemServico } from "../../domain/ordens-servico";
import { GerarOsModal } from "../../components/GerarOsModal";
import { supabase } from "../../../../lib/supabase-client";

const id=z.string().guid();
const abertura=z.object({clientId:id,chamadoId:id,createdBy:id,titulo:z.string().min(1).max(200),descricao:z.string().nullable(),categoria:z.enum(["corretiva","preventiva","melhoria","inspecao","emergencial","outro"]),prioridade:z.enum(["baixa","normal","media","alta","critica"]),gravidade:z.number().int().min(1).max(5),urgencia:z.number().int().min(1).max(5),tendencia:z.number().int().min(1).max(5),dorCliente:z.number().int().min(1).max(5).nullable(),observacao:z.string().nullable(),localDescricao:z.string().nullable(),solicitante:z.string().nullable(),origem:z.literal("manual"),tecnicoId:id.nullable(),tipoTarefaId:id.nullable(),dataPrevista:z.string().nullable(),tipoOs:z.enum(["C1","C2","P1","P2","IN"]).nullable(),pmocScheduleId:z.null(),origemInspecaoItemId:z.null(),equipamentoId:id.nullable(),fotoUrls:z.array(z.string())}).strict();
const pedidoSchema=z.object({requestId:id,osId:id,clienteId:id,chamadoId:id,ator:id,expectedRevision:z.number().int().safe().positive(),escopoSha256:z.string().regex(/^[a-f0-9]{64}$/).optional(),protocoloConcorrente:z.literal("escopo-v1").optional(),parcelaDireta:z.object({id,descricao:z.string().min(1).max(1000),escopoRevision:z.number().int().safe().positive(),motivo:z.string().trim().min(1).max(2000),origem:z.enum(["direta","backlog"]).optional()}).strict().optional(),abertura,destino:z.enum(["backlog","convertido_os"]),statusHub:z.enum(["corretiva","backlog","planejamento","em_execucao","finalizado","cancelado"]).nullable()}).strict().refine((p)=>(!p.protocoloConcorrente||!!p.escopoSha256)&&(!p.parcelaDireta||!!p.escopoSha256));
type Props={ habilitado?:string; usuario:string; cliente:string; chamado:string; chamadoEsperado:string; chamadoCompleto:Chamado; dadosOs:DadosAberturaOs|null; statusHubInicial?:Exclude<StatusOrdemServico,"solicitacao">|null; consultarRevisao:(cliente:string,chamado:string,signal?:AbortSignal)=>Promise<number>; listarEquipamentos:(cliente:string,chamado:string)=>Promise<EquipamentoAlvoOpcao[]>; criar:(pedido:PedidoConversaoIntegral)=>Promise<unknown>; aoConcluir?:(pedido:PedidoConversaoIntegral)=>void };

export function ConversaoIntegral(props:Props) {
  if(props.habilitado!=="true" || props.chamado!==props.chamadoEsperado) return null;
  return <Formulario key={JSON.stringify([props.usuario,props.cliente,props.chamado])} {...props}/>;
}

function Formulario({usuario,cliente,chamado,chamadoCompleto,dadosOs,statusHubInicial,consultarRevisao,listarEquipamentos,criar,aoConcluir}:Props) {
  const chave=`sso-conversao-integral:${usuario}:${cliente}:${chamado}`;
  const [recuperacao]=useState(()=>{try {const salvo=sessionStorage.getItem(chave); if(!salvo)return {pedido:null,erro:false}; const pedido=pedidoSchema.parse(JSON.parse(salvo)); if(pedido.ator!==usuario||pedido.clienteId!==cliente||pedido.chamadoId!==chamado||pedido.abertura.createdBy!==usuario||pedido.abertura.clientId!==cliente||pedido.abertura.chamadoId!==chamado)throw new Error("contexto"); return {pedido,erro:false};}catch{return {pedido:null,erro:true};}});
  const [pendente,setPendente]=useState<PedidoConversaoIntegral|null>(recuperacao.pedido);
  const [conflito,setConflito]=useState(false);
  const [rascunho,setRascunho]=useState<PedidoConversaoIntegral|null>(null);
  const [destino,setDestino]=useState<"backlog"|"convertido_os">(statusHubInicial==="backlog"?"backlog":"convertido_os");
  const [abrirModal,setAbrirModal]=useState(false);
  const [usarParcela,setUsarParcela]=useState(false);const [parcelaId,setParcelaId]=useState("");const [motivoParcela,setMotivoParcela]=useState("");
  const [origemParcela,setOrigemParcela]=useState<"direta"|"backlog">("direta");
  const [erro,setErro]=useState(""); const [enviando,setEnviando]=useState(false); const trava=useRef(false); const cache=useQueryClient();
  async function conferirSessao(signal?:AbortSignal){const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==usuario||signal?.aborted)throw new Error("Sessão alterada.");}
  const revisao=useQuery({queryKey:["s167-integral-revisao",usuario,cliente,chamado],queryFn:async({signal})=>{await conferirSessao(signal);const valor=await consultarRevisao(cliente,chamado,signal);await conferirSessao(signal);return valor;},enabled:Boolean(usuario&&cliente&&chamado),gcTime:0});
  const exigirEscopo=import.meta.env.VITE_SSO_CONVERSAO_ESCOPO_CONFERIDO_ENABLED==="true";
  const concorrente=exigirEscopo&&import.meta.env.VITE_SSO_CONVERSAO_OS_CONCORRENTE_ENABLED==="true";
  const fotografia=useQuery({queryKey:["s167-integral-escopo",usuario,cliente,chamado],queryFn:({signal})=>consultarFotografiaEscopoConversao(cliente,chamado,usuario,signal),enabled:exigirEscopo&&Boolean(usuario&&cliente&&chamado),gcTime:0,retry:false});
  const parcelaHabilitada=exigirEscopo&&import.meta.env.VITE_SSO_CRIAR_OS_PARCELA_DIRETA_ENABLED==="true";
  const parcelas=useInfiniteQuery({queryKey:["s167-parcelas-nova-os",usuario,cliente,chamado,origemParcela],enabled:parcelaHabilitada&&usarParcela,gcTime:0,retry:false,initialPageParam:null as string|null,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc(origemParcela==="backlog"?"sso_listar_parcelas_backlog_para_os":"sso_listar_parcelas_para_os",{p_ator_id:usuario,p_cliente_id:cliente,p_chamado_id:chamado,p_apos:pageParam,p_limite:50}).abortSignal(signal);
      if(error)throw error;const pagina=z.array(z.object({parcela_id:id,descricao:z.string().min(1).max(1000),chamado_revision:z.number().int().safe().positive(),escopo_revision:z.number().int().safe().positive()}).strict()).max(50).parse(data);
      let anterior=pageParam?.toLowerCase()??null;for(const p of pagina){const atual=p.parcela_id.toLowerCase();if(anterior!==null&&atual<=anterior)throw new Error("Página divergente.");anterior=atual;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(p)=>p.length===50?p.at(-1)?.parcela_id:undefined});
  const parcela=parcelas.data?.pages.flat().find((p)=>p.parcela_id===parcelaId);
  const componentes=useQuery({queryKey:["s167-componentes",usuario,cliente,chamado],queryFn:async({signal})=>{await conferirSessao(signal);const itens=await listarEquipamentos(cliente,chamado);await conferirSessao(signal);return itens;},enabled:abrirModal,gcTime:0,retry:false});
  const disponivel=!revisao.isPending&&!revisao.isFetching&&!revisao.isError&&revisao.data!==undefined&&(!exigirEscopo||(!fotografia.isPending&&!fotografia.isFetching&&!fotografia.isError&&fotografia.data?.revision===revisao.data));
  async function enviar(pedido:PedidoConversaoIntegral){
    if(trava.current)return; trava.current=true; setEnviando(true); setErro("");
    try {
      const antes=sessionStorage.getItem(chave); if(!antes||JSON.stringify(pedidoSchema.parse(JSON.parse(antes)))!==JSON.stringify(pedidoSchema.parse(pedido)))throw new Error("pedido divergente");
      await conferirSessao();
      if(sessionStorage.getItem(chave)!==antes)throw new Error("pedido divergente");
      await criar(pedido);
      await conferirSessao();
      const atual=sessionStorage.getItem(chave); if(!atual||JSON.stringify(pedidoSchema.parse(JSON.parse(atual)))!==JSON.stringify(pedidoSchema.parse(pedido)))throw new Error("pedido divergente");
      let atualizou=true;
      try { await cache.invalidateQueries({queryKey:chamadosOsQueryKeys.ordens(usuario,cliente,chamado)}); } catch { atualizou=false; }
      try {
        await conferirSessao();
        const antesDeLimpar=sessionStorage.getItem(chave);
        if(!antesDeLimpar||JSON.stringify(pedidoSchema.parse(JSON.parse(antesDeLimpar)))!==JSON.stringify(pedidoSchema.parse(pedido))) {
          setErro("OS confirmada, mas a tentativa local mudou. Reabra para conferir; não foi apagada."); return;
        }
      } catch { setErro("OS confirmada, mas não foi possível limpar ou conferir a tentativa local. Mantenha o pedido e procure suporte."); return; }
      try {
        sessionStorage.removeItem(chave);
      } catch {
        // A sessão e a tentativa foram conferidas, mas a limpeza falhou. A OS já
        // existe: atualize o contexto e preserve o pedido para reconciliação.
        try { aoConcluir?.(pedido); } catch { /* Não repetir a criação confirmada. */ }
        setErro("OS confirmada, mas não foi possível limpar ou conferir a tentativa local. Mantenha o pedido e procure suporte.");
        return;
      }
      setPendente(null);
      try { aoConcluir?.(pedido); } catch { /* O resultado já foi confirmado; não reenviar automaticamente. */ }
      if(!atualizou)setErro("OS confirmada, mas não foi possível atualizar a lista. Atualize a tela.");
      void revisao.refetch();
    } catch (e) {
      if(typeof e==="object" && e!==null && "code" in e && e.code==="40001" && "message" in e && (e.message==="revisao_obsoleta"||e.message==="escopo_alterado")) {
        setConflito(true); setErro("O Chamado foi alterado. Revise a operação antes de tentar novamente.");
      } else setErro("Resultado não confirmado. Mantenha a tentativa e repita a mesma operação ou procure suporte.");
    }
    finally { trava.current=false; setEnviando(false); }
  }
  return <section aria-label="Conversão integral de Chamado">
    <p>Conversão experimental: usa o formulário de abertura do Chamado. O servidor permanece bloqueado até homologação; o retry persiste apenas nesta aba.</p>
    {revisao.isFetching&&<output>Verificando revisão…</output>}
    {revisao.isError&&<p role="alert">Não foi possível consultar a revisão.</p>}
    {exigirEscopo&&fotografia.isFetching&&<output>Conferindo fotografia do escopo…</output>}
    {exigirEscopo&&fotografia.isError&&<p role="alert">Não foi possível conferir o escopo. <button type="button" onClick={()=>void fotografia.refetch()}>Tentar novamente</button></p>}
    {exigirEscopo&&!fotografia.isFetching&&!fotografia.isError&&fotografia.data&&revisao.data!==undefined&&fotografia.data.revision!==revisao.data&&<p role="alert">O Chamado mudou entre consultas. <button type="button" onClick={()=>{void revisao.refetch();void fotografia.refetch();}}>Recarregar dados</button></p>}
    {recuperacao.erro&&<p role="alert">Não foi possível recuperar a operação anterior. Procure suporte.</p>}
    {erro&&<p role="alert">{erro}</p>}
    {pendente?(conflito?<button type="button" disabled={enviando||!dadosOs} onClick={()=>void (async()=>{
      if(trava.current)return;trava.current=true;setEnviando(true);
      try {
        const salvo=sessionStorage.getItem(chave);
        if(!salvo||JSON.stringify(pedidoSchema.parse(JSON.parse(salvo)))!==JSON.stringify(pedidoSchema.parse(pendente)))throw new Error("pedido divergente");
        const atual=await revisao.refetch();
        if(atual.isError||atual.data===undefined)throw new Error("revisão indisponível");
        if(exigirEscopo){const foto=await fotografia.refetch();if(foto.isError||!foto.data||foto.data.revision!==atual.data)throw new Error("escopo indisponível");}
        if(pendente.parcelaDireta&&!parcelaHabilitada)throw new Error("Parcela indisponível.");
        setUsarParcela(!!pendente.parcelaDireta);setOrigemParcela(pendente.parcelaDireta?.origem??"direta");setParcelaId(pendente.parcelaDireta?.id??"");setMotivoParcela(pendente.parcelaDireta?.motivo??"");
        setRascunho(pendente);setDestino(pendente.destino);setPendente(null);setErro("");setAbrirModal(true);
      } catch {setErro("Não foi possível revisar a operação. Mantenha a tentativa e procure suporte.");}
      finally {trava.current=false;setEnviando(false);}
    })()}>Revisar e tentar novamente</button>:<button type="button" disabled={enviando} onClick={()=>void enviar(pendente)}>Repetir mesma operação</button>):<>
      {parcelaHabilitada&&statusHubInicial==null&&<label><input type="checkbox" checked={usarParcela} disabled={!!rascunho} onChange={(e)=>{setUsarParcela(e.target.checked);setParcelaId("");setDestino("convertido_os");}} /> Criar OS para uma parcela</label>}
      {usarParcela&&parcelaHabilitada&&<><p>A OS será criada em solicitação, sem técnico, agendamento ou envio Auvo.</p>
        <label>Origem <select value={origemParcela} disabled={!!rascunho} onChange={(e)=>{setOrigemParcela(e.target.value as typeof origemParcela);setParcelaId("");}}><option value="direta">Direta do Chamado</option><option value="backlog">Backlog</option></select></label>
        {parcelas.isFetching&&<output>Consultando parcelas…</output>}{parcelas.isError&&<p role="alert">Parcelas indisponíveis. <button type="button" onClick={()=>void parcelas.refetch()}>Tentar novamente</button></p>}
        {!parcelas.isFetching&&!parcelas.isError&&<><label>Parcela <select value={parcelaId} onChange={(e)=>setParcelaId(e.target.value)}><option value="">Escolha</option>{parcelas.data?.pages.flat().map((p)=><option key={p.parcela_id} value={p.parcela_id}>{p.descricao}</option>)}</select></label>
          {parcelas.hasNextPage&&<button type="button" onClick={()=>void parcelas.fetchNextPage()}>Mais parcelas</button>}</>}
        <label>Motivo <textarea maxLength={2000} value={motivoParcela} onChange={(e)=>setMotivoParcela(e.target.value)} /></label></>}
      <label>Destino <select value={destino} disabled={statusHubInicial!=null||usarParcela} onChange={(e)=>setDestino(e.target.value as typeof destino)}><option value="convertido_os">OS</option><option value="backlog">Backlog</option></select></label>
      <button type="button" disabled={enviando||!disponivel||recuperacao.erro||!dadosOs||(usarParcela&&(!parcela||parcelas.isFetching||parcelas.isError||parcela.chamado_revision!==revisao.data||!motivoParcela.trim()))} onClick={()=>setAbrirModal(true)}>{usarParcela?"Criar OS da parcela":"Criar OS integral"}</button>
      {abrirModal&&dadosOs&&<GerarOsModal chamado={chamadoCompleto} destino={destino} dadosOs={dadosOs} escopoEditavel valoresIniciais={rascunho?{titulo:rascunho.abertura.titulo,descricao:rascunho.abertura.descricao,tipoTarefaId:rascunho.abertura.tipoTarefaId??null,tecnicoId:rascunho.abertura.tecnicoId??null,dataPrevista:rascunho.abertura.dataPrevista??null,equipamentoId:rascunho.abertura.equipamentoId??null,gravidade:rascunho.abertura.gravidade,urgencia:rascunho.abertura.urgencia,tendencia:rascunho.abertura.tendencia}:undefined} componentes={{itens:componentes.data??[],carregando:componentes.isPending||componentes.isFetching,erro:componentes.isError,tentarNovamente:()=>{void componentes.refetch();}}} onCancel={()=>{setAbrirModal(false);if(rascunho){setPendente(rascunho);setRascunho(null);}}} onConfirmar={async(campos)=>{
        if(!disponivel||recuperacao.erro||trava.current)return;
        const comando=prepararAberturaOrdemServico({clientId:cliente,chamadoId:chamado,createdBy:usuario,titulo:campos.titulo??chamadoCompleto.titulo,descricao:campos.descricao??null,categoria:"corretiva",prioridade:"media",gravidade:campos.gravidade,urgencia:campos.urgencia,tendencia:campos.tendencia,dorCliente:null,observacao:null,localDescricao:null,solicitante:chamadoCompleto.solicitante,origem:"manual",tecnicoId:campos.tecnicoId,tipoTarefaId:campos.tipoTarefaId,dataPrevista:campos.dataPrevista,equipamentoId:campos.equipamentoId??null,fotoUrls:chamadoCompleto.fotoUrls});
        if((rascunho?.parcelaDireta&&!usarParcela)||(usarParcela&&(!parcelaHabilitada||!parcela||parcelas.isFetching||parcelas.isError||parcela.chamado_revision!==revisao.data||comando.tecnicoId||comando.dataPrevista))){setErro("Confira a parcela e remova técnico e agendamento.");return;}
        const parsed=pedidoSchema.safeParse({requestId:crypto.randomUUID(),osId:crypto.randomUUID(),clienteId:cliente,chamadoId:chamado,ator:usuario,expectedRevision:revisao.data,...(exigirEscopo?{escopoSha256:fotografia.data?.escopoSha256}:{}),...(concorrente&&!usarParcela?{protocoloConcorrente:"escopo-v1"}:{}),...(usarParcela&&parcela?{parcelaDireta:{id:parcela.parcela_id,descricao:parcela.descricao,escopoRevision:parcela.escopo_revision,motivo:motivoParcela.trim(),origem:origemParcela}}:{}),destino,statusHub:usarParcela?null:rascunho?rascunho.statusHub:statusHubInicial??null,abertura:comando});
        if(!parsed.success){setErro("Confira dados e revisão do Chamado.");return;}
        try {if(sessionStorage.getItem(`sso-criar-os:${usuario}:${cliente}:${chamado}`)!==null){setErro("Há uma criação de OS pendente neste Chamado. Resolva-a antes de iniciar outra operação.");return;}const salvo=sessionStorage.getItem(chave);if(rascunho){if(!salvo||JSON.stringify(pedidoSchema.parse(JSON.parse(salvo)))!==JSON.stringify(pedidoSchema.parse(rascunho)))throw new Error("operação divergente");}else if(salvo!==null)throw new Error("operação pendente");sessionStorage.setItem(chave,JSON.stringify(parsed.data));} catch {setErro("Não foi possível guardar a operação. Procure suporte.");return;}
        setRascunho(null);setConflito(false);setPendente(parsed.data);setAbrirModal(false);await enviar(parsed.data);
      }}/>}
    </>}
  </section>;
}
