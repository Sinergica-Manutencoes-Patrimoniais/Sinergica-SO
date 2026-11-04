import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { EvidenciasDeclaradas } from "./EvidenciasDeclaradas";

type Pergunta = {id:string;texto:string | null};
type Envelope = {envelope_id:string;resolucao_id:string;os_id:string;task_id:string;ocorrido_em:string | null;recebido_em:string;perguntas:Pergunta[]};
type Resposta = {perguntaId:string;resultado:string;observacao:string};
type Pedido = {requestId:string;clienteId:string;envelopeId:string;resolucaoId:string;retornoId:string;respostas:Resposta[]};

export function ClassificarRetorno({userId,clienteId}:{userId:string;clienteId:string}) {
  const chave=`sso-classificacao-retorno:${JSON.stringify([userId,clienteId])}`;
  const trava=useRef(false);
  const [selecionado,setSelecionado]=useState("");
  const [respostas,setRespostas]=useState<Record<string,{resultado:string;observacao:string}>>({});
  const [mensagem,setMensagem]=useState("");
  const [pedido,setPedido]=useState<Pedido | "invalido" | null>(() => {try {const salvo=sessionStorage.getItem(chave); if(!salvo)return null;
    const p=JSON.parse(salvo) as Pedido; return p && p.clienteId===clienteId && typeof p.requestId==="string" &&
      typeof p.envelopeId==="string" && typeof p.resolucaoId==="string" && typeof p.retornoId==="string" && Array.isArray(p.respostas) ? p : "invalido";
  } catch {return "invalido";}});
  const cache=useQueryClient();
  const envelopes=useInfiniteQuery({queryKey:["retorno-campo-classificar",userId,clienteId],gcTime:0,initialPageParam:null as string | null,
    queryFn:async ({pageParam,signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");const {data,error}=await supabase.schema("pcm").rpc("sso_listar_retornos_classificaveis_mediada",{
      p_cliente_id:clienteId,p_apos:pageParam,p_limite:30}).abortSignal(signal);
      if(error)throw error; if(!Array.isArray(data) || data.some((e) => typeof e.envelope_id!=="string" || typeof e.resolucao_id!=="string" ||
        typeof e.os_id!=="string" || typeof e.task_id!=="string" || !Array.isArray(e.perguntas) || e.perguntas.some((p:unknown) => !p || typeof p!=="object" || !("id" in p) || typeof p.id!=="string"))) throw new Error("Envelope inválido.");
      let cursor=pageParam?.toLowerCase()??null;for(const item of data){const id=item.envelope_id.toLowerCase();if(cursor!==null&&id<=cursor)throw new Error("Página divergente.");cursor=id;}const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return data as Envelope[];},getNextPageParam:(pagina) => pagina.length===30 ? pagina.at(-1)?.envelope_id : undefined});
  const envio=useMutation({mutationFn:async (p:Pedido) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");const {data,error}=await supabase.schema("pcm").rpc("sso_classificar_retorno_campo_mediada",{
    p_request_id:p.requestId,p_cliente_id:p.clienteId,p_envelope_id:p.envelopeId,p_resolucao_id:p.resolucaoId,p_retorno_id:p.retornoId,p_respostas:p.respostas});
    if(error)throw error;if(!data || data.requestId!==p.requestId || data.retornoId!==p.retornoId || data.coberturaComprovada!==false)throw new Error("Resposta inválida.");const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");},
    onSuccess:async (_resultado, p) => {try {if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();sessionStorage.removeItem(chave);}catch {setMensagem("Classificação registrada, mas tentativa local mudou ou não foi removida. Procure suporte.");return;}
      setPedido(null);setRespostas({});setSelecionado("");setMensagem("Classificação declarada. Cobertura e execução não foram comprovadas.");await cache.invalidateQueries({queryKey:["retorno-campo-classificar",userId,clienteId]});},
    onError:() => setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."),onSettled:() => {trava.current=false;}});
  const enviar=(p:Pedido) => {if(trava.current)return;trava.current=true;envio.mutate(p);};
  return <section aria-label="Classificação manual do retorno de campo"><h2>Classificação manual do retorno</h2>
    <EvidenciasDeclaradas userId={userId} clienteId={clienteId} />
    <p>Confira a evidência de campo em sua fonte autorizada. Esta tela mostra metadados do envelope e perguntas históricas, não o conteúdo original; não presume execução nem libera aprovação.</p>
    {envelopes.isFetching && <output>Carregando envelopes…</output>}
    {envelopes.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void envelopes.refetch()}>Tentar novamente</button></p>}
    {envelopes.data && !envelopes.isFetching && !envelopes.isError && <ul>{envelopes.data.pages.flat().map((e) => <li key={e.envelope_id}>
      OS {e.os_id} · tarefa {e.task_id} · envelope {e.envelope_id} · recebido {e.recebido_em} · ocorrido {e.ocorrido_em ?? "não informado"}
      <button type="button" onClick={() => {setSelecionado(e.envelope_id);setRespostas({});}}>Conferir perguntas</button>
      {selecionado===e.envelope_id && <form onSubmit={(event) => {event.preventDefault(); if(pedido || trava.current || !e.perguntas.length || envelopes.isFetching || envelopes.isError) return;
        const r=e.perguntas.map((q) => ({perguntaId:q.id,resultado:respostas[q.id]?.resultado ?? "",observacao:respostas[q.id]?.observacao.trim() ?? ""}));
        if(r.some((x) => !x.resultado || (x.resultado==="nao_aplicavel" && !x.observacao))) {setMensagem("Classifique todas as perguntas e justifique cada Não aplicável.");return;}
        const p:Pedido={requestId:crypto.randomUUID(),clienteId,envelopeId:e.envelope_id,resolucaoId:e.resolucao_id,retornoId:crypto.randomUUID(),respostas:r};
        try {if(sessionStorage.getItem(chave)!==null){setMensagem("Há tentativa anterior; reabra para recuperar.");return;}sessionStorage.setItem(chave,JSON.stringify(p));}
        catch {setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}setPedido(p);enviar(p);
      }}><fieldset disabled={!!pedido || envio.isPending}>
        {!e.perguntas.length && <p>Perguntas históricas indisponíveis; classificação bloqueada.</p>}
        {e.perguntas.map((q) => <div key={q.id}><p>{q.texto ?? `Pergunta ${q.id}`} · ID {q.id}</p>
          <label>Classificação <select required value={respostas[q.id]?.resultado ?? ""} onChange={(event) => setRespostas((atual) => ({...atual,[q.id]:{resultado:event.target.value,observacao:atual[q.id]?.observacao ?? ""}}))}>
            <option value="">Selecione</option><option value="ok">OK</option><option value="nao_ok">Não OK</option><option value="nao_aplicavel">Não aplicável</option><option value="nao_inspecionado">Não inspecionado</option><option value="corrigido">Corrigido</option>
          </select></label>
          <label>Observação <input maxLength={4000} value={respostas[q.id]?.observacao ?? ""} onChange={(event) => setRespostas((atual) => ({...atual,[q.id]:{resultado:atual[q.id]?.resultado ?? "",observacao:event.target.value}}))} /></label>
        </div>)}
        <button type="submit" disabled={!e.perguntas.length}>Registrar declaração manual</button>
      </fieldset></form>}
    </li>)}</ul>}
    {envelopes.hasNextPage && <button type="button" onClick={() => void envelopes.fetchNextPage()}>Mais envelopes</button>}
    {pedido==="invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    {pedido && pedido!=="invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pedido)}>Repetir mesmo pedido</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
