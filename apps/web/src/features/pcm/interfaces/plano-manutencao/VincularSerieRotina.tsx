import { useInfiniteQuery,useMutation,useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCalendarioContratualAdapter } from "../../infrastructure/supabase-calendario-contratual-adapter";
import { VigenciaSerieRotina } from "./VigenciaSerieRotina";
import { PreviaOcorrenciasVisita } from "./PreviaOcorrenciasVisita";
import { CiclosUniformes } from "./CiclosUniformes";
import { GerarVisitaContratual } from "./GerarVisitaContratual";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

type Pedido={requestId:string;clienteId:string;planoId:string;versaoId:string;rotinaId:string;serieId:string;revision:number;tentativaIncerta?:boolean};
type Props = {userId:string;clienteId:string;planoId:string;versaoId:string;rotinaId:string;revision:number};
export function VincularSerieRotina(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.planoId,props.versaoId,props.rotinaId])} {...props} />;
}
function Conteudo({userId,clienteId,planoId,versaoId,rotinaId,revision}: Props) {
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const chave=`sso-rotina-serie:${JSON.stringify([userId,clienteId,planoId,rotinaId])}`;const cache=useQueryClient();const primeira=useRef(false);
  const [serieId,setSerieId]=useState("");const [mensagem,setMensagem]=useState("");
  const [pedido,setPedido]=useState<Pedido|"invalido"|null>(() => {try{const salvo=sessionStorage.getItem(chave);if(!salvo)return null;const p=JSON.parse(salvo) as Pedido;
    return p&&p.clienteId===clienteId&&p.planoId===planoId&&p.versaoId===versaoId&&p.rotinaId===rotinaId&&typeof p.serieId==="string"&&typeof p.requestId==="string"&&Number.isSafeInteger(p.revision)&&(p.tentativaIncerta===undefined||typeof p.tentativaIncerta==="boolean") ? p : "invalido";}catch{return "invalido";}});
  const regras=useInfiniteQuery({queryKey:["rotina-serie-regras",userId,clienteId],gcTime:0,initialPageParam:null as string|null,
    queryFn:async({pageParam,signal}) => {await conferirSessaoDiagnostico(userId,signal);const pagina=await supabaseCalendarioContratualAdapter.listarRegras(clienteId,50,pageParam,signal);await conferirSessaoDiagnostico(userId,signal);return pagina;},
    getNextPageParam:(pagina) => pagina.length===50 ? pagina.at(-1)?.id : undefined});
  const vinculos=useInfiniteQuery({queryKey:["rotina-serie-vinculos",userId,clienteId,planoId,rotinaId],gcTime:0,initialPageParam:null as string|null,
    queryFn:async({pageParam,signal}) => {await conferirSessaoDiagnostico(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_listar_series_rotina_mediado",{
      p_ator:userId,p_cliente:clienteId,p_plano:planoId,p_rotina:rotinaId,p_apos:pageParam,p_limite:50}).abortSignal(signal);if(error)throw error;
      if(!Array.isArray(data)||data.some((v) => typeof v.serie_id!=="string"||typeof v.criado_em!=="string"))throw new Error("Vínculos inválidos.");
      await conferirSessaoDiagnostico(userId,signal);return data as {serie_id:string;criado_em:string}[];},getNextPageParam:(pagina) => pagina.length===50 ? pagina.at(-1)?.serie_id : undefined});
  const envio=useMutation({mutationFn:async(p:Pedido) => {await conferirSessaoDiagnostico(userId); if (!montado.current) throw new Error("Tela desmontada.");if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");const {data,error}=await supabase.schema("pcm").rpc("sso_vincular_serie_rotina_mediado",{
    p_ator:userId,p_cliente:p.clienteId,p_request:p.requestId,p_plano:p.planoId,p_versao:p.versaoId,p_rotina:p.rotinaId,p_serie:p.serieId,p_revisao:p.revision});
    if(error)throw error;if(!data||data.requestId!==p.requestId||data.planoId!==p.planoId||data.serieId!==p.serieId)throw new Error("Resposta inválida.");await conferirSessaoDiagnostico(userId); if (!montado.current) throw new Error("Tela desmontada.");},
    onSuccess:async(_r,p) => {try{await conferirSessaoDiagnostico(userId); if (!montado.current) throw new Error("Tela desmontada.");if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");sessionStorage.removeItem(chave);}catch{setMensagem("Vínculo registrado, mas tentativa não foi removida. Procure suporte.");return;}
      setPedido(null);setMensagem("Vínculo registrado. Nenhuma ocorrência, OS ou tarefa foi criada.");await Promise.all([cache.invalidateQueries({queryKey:["rotina-serie-vinculos",userId,clienteId,planoId,rotinaId]}),cache.invalidateQueries({queryKey:["reserva-futuro-series",userId,clienteId,planoId,rotinaId]}),cache.invalidateQueries({queryKey:["reserva-futuro-visitas",userId,clienteId,planoId]}),cache.invalidateQueries({queryKey:["reserva-futuro",userId,clienteId,planoId]})]);},
    onError:async(error,p) => {const e=error as {code?:string;message?:string};if(primeira.current&&e.code==="P0011"&&e.message==="revisao_obsoleta"){try{await conferirSessaoDiagnostico(userId); if (!montado.current) throw new Error("Tela desmontada.");if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");sessionStorage.removeItem(chave);setPedido(null);setMensagem("O Plano mudou. Atualize e confira novamente antes de vincular.");await cache.invalidateQueries({queryKey:["rotina-serie-vinculos",userId,clienteId,planoId,rotinaId]});return;}catch{/* Preserve tentativa em caso de dúvida. */}}setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte.");},onSettled:()=>{primeira.current=false;}});
  const enviar=(p:Pedido)=>{if(envio.isPending)return;try{const anterior=sessionStorage.getItem(chave);if(anterior!==null&&anterior!==JSON.stringify(p))throw new Error();primeira.current=p.tentativaIncerta===false;const marcado={...p,tentativaIncerta:true};sessionStorage.setItem(chave,JSON.stringify(marcado));setPedido(marcado);envio.mutate(marcado);}catch{setMensagem("Não foi possível guardar tentativa; nada foi enviado.");}};
  const opcoes=[...new Map((regras.data?.pages.flat()??[]).map((r) => [r.serieId,r])).values()];const selecionada=opcoes.find((r) => r.serieId===serieId);
  return <section aria-label="Vínculo de Rotina por Visita"><h4>Vínculo de Rotina com série contratual</h4>
    <p>Prévia da escolha: o vínculo não cria ocorrências nem comprova feriados, vigências operacionais ou ausência de duplicidade PMOC.</p>
    {regras.isFetching&&<output>Carregando séries…</output>}{regras.isError&&<p role="alert">Séries indisponíveis. <button type="button" onClick={() => void regras.refetch()}>Tentar novamente</button></p>}
    {vinculos.isFetching&&<output>Carregando vínculos…</output>}{vinculos.isError&&<p role="alert">Vínculos indisponíveis. <button type="button" onClick={() => void vinculos.refetch()}>Tentar novamente</button></p>}
    {!vinculos.isFetching&&!vinculos.isError&&<ul>{vinculos.data?.pages.flat().map((v) => <li key={v.serie_id}>Série {v.serie_id} · criada {v.criado_em}
      {import.meta.env.VITE_SSO_VIGENCIA_ROTINA_SERIE_ENABLED === "true" && <VigenciaSerieRotina userId={userId} clienteId={clienteId} planoId={planoId} rotinaId={rotinaId} serieId={v.serie_id} />}
      {import.meta.env.VITE_SSO_PREVIA_OCORRENCIA_VISITA_ENABLED === "true" && <PreviaOcorrenciasVisita userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} serieId={v.serie_id} revision={revision} />}
      {import.meta.env.VITE_SSO_CICLOS_UNIFORMES_ENABLED === "true" && <CiclosUniformes userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} serieId={v.serie_id} />}
      {import.meta.env.VITE_SSO_GERAR_VISITA_CONTRATUAL_ENABLED === "true" && <GerarVisitaContratual userId={userId} clienteId={clienteId} serieId={v.serie_id} />}
    </li>)}</ul>}
    {vinculos.hasNextPage&&<button type="button" onClick={() => void vinculos.fetchNextPage()}>Mais vínculos</button>}
    <form onSubmit={(event) => {event.preventDefault();if(pedido||!selecionada||regras.isFetching||regras.isError||vinculos.isFetching||vinculos.isError)return;
      const p:Pedido={requestId:crypto.randomUUID(),clienteId,planoId,versaoId,rotinaId,serieId,revision,tentativaIncerta:false};
      try{if(sessionStorage.getItem(chave)!==null){setMensagem("Há tentativa anterior; reabra para recuperar.");return;}sessionStorage.setItem(chave,JSON.stringify(p));}
      catch{setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}setPedido(p);enviar(p);
    }}><fieldset disabled={!!pedido||envio.isPending||regras.isFetching||regras.isError||vinculos.isFetching||vinculos.isError}>
      <label>Série <select required value={serieId} onChange={(e) => setSerieId(e.target.value)}><option value="">Selecione</option>{opcoes.map((r) => <option key={r.serieId} value={r.serieId}>Contrato {r.contratoId} · série {r.serieId}</option>)}</select></label>
      {selecionada&&<p>Contrato {selecionada.contratoId} · série {selecionada.serieId}; verifique regras e vigências antes de confirmar.</p>}
      <button type="submit" disabled={!selecionada}>Confirmar vínculo</button></fieldset></form>
    {regras.hasNextPage&&<button type="button" onClick={() => void regras.fetchNextPage()}>Mais séries</button>}
    {pedido==="invalido"&&<p role="alert">Tentativa ilegível. Procure suporte.</p>}{pedido&&pedido!=="invalido"&&<button type="button" disabled={envio.isPending} onClick={() => enviar(pedido)}>Repetir mesmo pedido</button>}{mensagem&&<p role="status">{mensagem}</p>}
  </section>;
}
