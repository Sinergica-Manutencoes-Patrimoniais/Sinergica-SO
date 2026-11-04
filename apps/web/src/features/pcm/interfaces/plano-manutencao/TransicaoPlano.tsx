import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { PlanoResumo } from "../../application/plano-manutencao-gateway";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { InventarioGeracaoLegada } from "./InventarioGeracaoLegada";
import { RelacaoPlanoLegado } from "./RelacaoPlanoLegado";

type Pedido={requestId:string;planoId:string;clienteId:string;revision:number;acao:"suspender"|"encerrar"|"retomar";vigencia:string;motivo:string};
const pedidoSchema=z.object({requestId:z.string().uuid(),planoId:z.string().uuid(),clienteId:z.string().uuid(),revision:z.number().int().nonnegative().safe(),acao:z.enum(["suspender","encerrar","retomar"]),vigencia:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),motivo:z.string().trim().min(1).max(2000)}).strict();
type Props={userId:string;clienteId:string;plano:PlanoResumo;bloqueado:boolean;onAbrirRotinas?:()=>void};
export function TransicaoPlano(props:Props) {
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.plano.id])} {...props} />;
}
function Conteudo({userId,clienteId,plano,bloqueado,onAbrirRotinas}:Props) {
  const chave=`sso-plano-transicao:${JSON.stringify([userId,clienteId,plano.id])}`;const cache=useQueryClient();
  const trava=useRef(false);
  const [acao,setAcao]=useState<Pedido["acao"]>(plano.estado === "suspenso" ? "retomar" : "suspender");const [vigencia,setVigencia]=useState("");const [motivo,setMotivo]=useState("");const [mensagem,setMensagem]=useState("");
  const [confirmado,setConfirmado]=useState<string|null>(null);
  const fotografia=JSON.stringify({userId,clienteId,planoId:plano.id,revisao:plano.revisao,estado:plano.estado,acao,vigencia,motivo});
  const [pedido,setPedido]=useState<Pedido|"invalido"|null>(() => {try {const salvo=sessionStorage.getItem(chave);if(!salvo)return null;const p=pedidoSchema.parse(JSON.parse(salvo));
    return p.planoId===plano.id&&p.clienteId===clienteId ? p : "invalido";}catch{return "invalido";}});
  const permissao=useQuery({queryKey:["plano-transicao-permissao",userId,clienteId],gcTime:0,refetchOnWindowFocus:true,
    queryFn:async({signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");const autorizada=await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir",clienteId);const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return autorizada;}});
  const acessoConferido=permissao.data===true&&!permissao.isFetching&&!permissao.isError;
  const historico=useInfiniteQuery({queryKey:["plano-transicoes-historico",userId,clienteId,plano.id],enabled:import.meta.env.VITE_SSO_HISTORICO_TRANSICOES_PLANO_ENABLED === "true" && acessoConferido,gcTime:0,initialPageParam:null as number|null,
    queryFn:async({pageParam,signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");const parametros={p_cliente_id:clienteId,p_plano_id:plano.id,p_antes:pageParam,p_limite:20};const {data,error}=await (import.meta.env.VITE_SSO_TRANSICAO_PLANO_MEDIADA_ENABLED==="true"?supabase.schema("pcm").rpc("sso_historico_transicoes_plano_mediado",{...parametros,p_ator_id:userId}):supabase.schema("pcm").rpc("sso_historico_transicoes_plano",parametros)).abortSignal(signal);if(error)throw error;const pagina=z.array(z.object({id:z.string().uuid(),revisao:z.number().int().positive(),acao:z.enum(["suspender","encerrar","retomar"]),estado_anterior:z.string(),estado_novo:z.string(),vigencia:z.string(),motivo:z.string(),ator_id:z.string().uuid(),criado_em:z.string()}).strict()).max(20).parse(data);let anterior=pageParam??Number.MAX_SAFE_INTEGER;for(const item of pagina){if(item.revisao>=anterior)throw new Error("Página divergente.");anterior=item.revisao;}const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},getNextPageParam:(p) => p.length===20?p.at(-1)?.revisao:undefined});
  const envio=useMutation({mutationFn:async(p:Pedido) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");const {data,error}=import.meta.env.VITE_SSO_TRANSICAO_PLANO_MEDIADA_ENABLED==="true"
    ? await supabase.schema("pcm").rpc("sso_transicao_plano_mediada",{p_ator_id:userId,p_cliente_id:p.clienteId,p_request_id:p.requestId,p_plano_id:p.planoId,p_expected_revision:p.revision,p_acao:p.acao,p_vigencia:p.vigencia,p_motivo:p.motivo})
    : p.acao === "retomar"
    ? await supabase.schema("pcm").rpc("sso_retomar_plano_preparado",{p_request_id:p.requestId,p_plano_id:p.planoId,p_expected_revision:p.revision,p_vigencia:p.vigencia,p_motivo:p.motivo})
    : await supabase.schema("pcm").rpc("sso_transicionar_plano_preparado",{p_request_id:p.requestId,p_plano_id:p.planoId,p_expected_revision:p.revision,p_acao:p.acao,p_vigencia:p.vigencia,p_motivo:p.motivo});
    if(error)throw error;const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||!data||data.requestId!==p.requestId||data.aggregateId!==p.planoId||data.revision!==p.revision+1||data.linkedIds?.clienteId!==p.clienteId)throw new Error("Resposta inválida ou sessão alterada.");},
    onSuccess:async (_resultado,p) => {try{await Promise.all([cache.invalidateQueries({queryKey:["plano-manutencao",userId,clienteId]}),cache.invalidateQueries({queryKey:["plano-transicoes-historico",userId,clienteId,plano.id]})]);const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");sessionStorage.removeItem(chave);}catch{setMensagem("Transição confirmada, mas tentativa não pôde ser conferida ou removida. Preserve o pedido e procure suporte.");return;}
      setPedido(null);setConfirmado(null);setMensagem("Estado registrado. OS existentes e geradores legados não foram alterados.");},
    onError:() => setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;trava.current=true;envio.mutate(p);}
  const permitido=acessoConferido&&!bloqueado;
  return <section aria-label="Transição do Plano"><h4>Transição do Plano</h4>
    <p>Esta etapa aceita apenas o dia atual conforme a configuração de fuso. Sem configuração ativa, usa São Paulo; se o fuso histórico exigido estiver incompleto, é necessária conferência. Não altera OS, não aciona Auvo e não comprova interrupção dos geradores legados.</p>
    {import.meta.env.VITE_SSO_INVENTARIO_GERACAO_LEGADA_ENABLED === "true" && acessoConferido && <InventarioGeracaoLegada userId={userId} clienteId={clienteId} />}
    {import.meta.env.VITE_SSO_RELACAO_PLANO_LEGADO_ENABLED === "true" && acessoConferido && <RelacaoPlanoLegado userId={userId} clienteId={clienteId} planoId={plano.id} revision={plano.revisao} />}
    {permissao.isFetching && <output>Verificando permissão…</output>}{permissao.isError && <p role="alert">Permissão indisponível. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>}
    {!permissao.isFetching&&!permissao.isError&&!permissao.data && <p>Sem permissão para gerir este Plano.</p>}
    {plano.estado === "suspenso" && <p>Retomada não gera atrasados automaticamente. A prévia de cada Rotina por calendário pode mostrar ciclos previstos, inclusive sem ocorrência preparada; a triagem e a decisão disponíveis são preliminares e não criam ocorrências. A decisão operacional completa continua pendente. {onAbrirRotinas && (import.meta.env.VITE_SSO_TRIAGEM_CICLO_ATRASADO_ENABLED === "true" || import.meta.env.VITE_SSO_DECISAO_VENCIMENTO_ENABLED === "true") && <button type="button" disabled={bloqueado} onClick={onAbrirRotinas}>Abrir Rotinas para conferência</button>}</p>}
    {(plano.estado === "aprovado" || plano.estado === "ativo" || plano.estado === "suspenso") && <form onSubmit={(event) => {event.preventDefault();if(!permitido||pedido||trava.current||confirmado!==fotografia||!vigencia||!motivo.trim())return;
      const acaoAtual = plano.estado === "suspenso" ? "retomar" : acao === "retomar" ? "suspender" : acao;
      const p:Pedido={requestId:crypto.randomUUID(),planoId:plano.id,clienteId,revision:plano.revisao,acao:acaoAtual,vigencia,motivo:motivo.trim()};
      try{if(sessionStorage.getItem(chave)!==null){setMensagem("Há tentativa anterior; reabra para recuperar.");return;}sessionStorage.setItem(chave,JSON.stringify(p));}
      catch{setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}setPedido(p);enviar(p);
    }}><fieldset disabled={!!pedido||envio.isPending||bloqueado}>
      {plano.estado === "suspenso" ? <p>Ação: retomar</p> : <label>Ação <select value={acao === "retomar" ? "suspender" : acao} onChange={(e) => setAcao(e.target.value as Pedido["acao"])}><option value="suspender">Suspender</option><option value="encerrar">Encerrar</option></select></label>}
      <label>Vigência <input required type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)}/></label>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)}/></label>
      {confirmado && confirmado!==fotografia && <p role="alert">Dados do Plano ou da transição mudaram; confira novamente.</p>}
      <label><input type="checkbox" checked={confirmado===fotografia} onChange={(e)=>setConfirmado(e.target.checked?fotografia:null)}/> Conferi a ação, vigência, motivo e revisão do Plano.</label>
      <button type="submit" disabled={!permitido||confirmado!==fotografia}>Confirmar transição local</button>
    </fieldset></form>}
    {pedido==="invalido" && <p role="alert">Tentativa ilegível ou alterada. Procure suporte.</p>}{pedido&&pedido!=="invalido" && <button type="button" disabled={!permitido||envio.isPending} onClick={() => enviar(pedido)}>Repetir mesmo pedido</button>}
    {mensagem && <p role="status">{mensagem}</p>}
    {import.meta.env.VITE_SSO_HISTORICO_TRANSICOES_PLANO_ENABLED === "true" && acessoConferido && <section><h5>Histórico de transições preparadas</h5><p>Não inclui necessariamente ações por caminhos legados e não comprova interrupção de geradores.</p>{historico.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}{!historico.isFetching&&!historico.isError&&<ul>{historico.data?.pages.flat().map((h) => <li key={h.id}>Revisão {h.revisao} · {h.acao} · {h.estado_anterior} → {h.estado_novo} · vigência {h.vigencia} · {h.motivo} · {h.ator_id} · {h.criado_em}</li>)}</ul>}{historico.hasNextPage && !historico.isError && <button type="button" disabled={historico.isFetching} onClick={() => void historico.fetchNextPage()}>Mais histórico</button>}</section>}
  </section>;
}
