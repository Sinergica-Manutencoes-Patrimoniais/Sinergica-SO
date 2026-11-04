import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { EvidenciasOs } from "./EvidenciasOs";
import { DeclararEvidenciaOs } from "./DeclararEvidenciaOs";
import { RevalidarIncertezaOs } from "./RevalidarIncertezaOs";
import { DiagnosticoSnapshotOs } from "./DiagnosticoSnapshotOs";
import { InboxOsIncerta } from "./InboxOsIncerta";
import { ConflitosWebhook } from "./ConflitosWebhook";
import { IntencoesReprogramacao } from "./IntencoesReprogramacao";
import { ObservarOrdens } from "./ObservarOrdens";
import { HistoricoObservacaoOs } from "./HistoricoObservacaoOs";
import { ConflitosPropriedadeOs } from "./ConflitosPropriedadeOs";

type Ordem = { id:string; numero:string; status_operacional:string; status_sync:string | null; auvo_task_id:string | null; atualizado_em:string; classificacao:string };
type Pedido = { requestId:string; clienteId:string; osId:string; atualizadoEm:string; sync:string | null; taskId:string | null; nota:string };
const pedidoSchema = z.object({ requestId:z.string().uuid(), clienteId:z.string().uuid(), osId:z.string().uuid(), atualizadoEm:z.string().refine((v) => Number.isFinite(Date.parse(v))), sync:z.string().nullable(), taskId:z.string().nullable(), nota:z.string().trim().min(1).max(1000) }).strict();

export function OrdensAuvo({ userId,clienteId,onAbrirOs }: {userId:string;clienteId:string;onAbrirOs?: (osId:string)=>void}) {
  return <Conteudo key={JSON.stringify([userId,clienteId])} userId={userId} clienteId={clienteId} onAbrirOs={onAbrirOs} />;
}
function Conteudo({ userId,clienteId,onAbrirOs }: {userId:string;clienteId:string;onAbrirOs?: (osId:string)=>void}) {
  const chave = `sso-reconciliacao-os:${JSON.stringify([userId,clienteId])}`;
  const enviando = useRef(false);
  const [selecionado,setSelecionado] = useState("");
  const [nota,setNota] = useState("");
  const [mensagem,setMensagem] = useState("");
  const [pedido,setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {const salvo=sessionStorage.getItem(chave); if (!salvo) return null; const p=pedidoSchema.parse(JSON.parse(salvo));
      return p.clienteId===clienteId ? p : "invalido";
    } catch {return "invalido";}
  });
  const cache=useQueryClient();
  const ordens=useInfiniteQuery({queryKey:["reconciliacao-os",userId,clienteId],gcTime:0,initialPageParam:null as string | null,
    queryFn:async ({pageParam,signal}) => {const {data,error}=await supabase.schema("pcm").rpc("sso_listar_os_reconciliacao",{p_cliente_id:clienteId,p_apos:pageParam,p_limite:50}).abortSignal(signal);
      if(error) throw error; if(!Array.isArray(data) || data.some((o) => typeof o.id!=="string" || typeof o.atualizado_em!=="string" || typeof o.classificacao!=="string" || (o.auvo_task_id !== null && typeof o.auvo_task_id !== "string"))) throw new Error("Resposta inválida."); return data as Ordem[];},
    getNextPageParam:(pagina) => pagina.length===50 ? pagina.at(-1)?.id : undefined});
  const notas=useInfiniteQuery({queryKey:["reconciliacao-os-notas",userId,clienteId,selecionado],enabled:!!selecionado,gcTime:0,
    initialPageParam:null as {data:string;id:string} | null,
    queryFn:async ({pageParam,signal}) => {
      const antes=await supabase.auth.getUser();
      if(antes.error || antes.data.user?.id!==userId || signal.aborted) throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_listar_notas_os_reconciliacao",{
      p_cliente_id:clienteId,p_os_id:selecionado,p_apos:pageParam?.data ?? null,p_apos_id:pageParam?.id ?? null,p_limite:50}).abortSignal(signal);
      if(error) throw error;
      const pagina=z.array(z.object({request_id:z.string().uuid(),ator_id:z.string().uuid(),nota:z.string().min(1).max(1000),versao_observada:z.string().refine((v)=>Number.isFinite(Date.parse(v))),sync_observado:z.string().nullable(),task_observada:z.string().nullable(),criado_em:z.string().refine((v)=>Number.isFinite(Date.parse(v)))}).strict()).max(50).parse(data);
      const ids=new Set<string>();
      let instanteAnterior=pageParam ? Date.parse(pageParam.data) : -Infinity;
      for(const n of pagina) {
        const instante=Date.parse(n.criado_em);
        const id=n.request_id.toLowerCase();
        if(instante<instanteAnterior || ids.has(id) || (pageParam && id===pageParam.id.toLowerCase())) throw new Error("Página inválida.");
        instanteAnterior=instante; ids.add(id);
      }
      const depois=await supabase.auth.getUser();
      if(depois.error || depois.data.user?.id!==userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;},
    getNextPageParam:(pagina) => { const ultima = pagina.at(-1); return pagina.length===50 && ultima ? {data:ultima.criado_em,id:ultima.request_id} : undefined; }});
  const envio=useMutation({mutationFn:async (p:Pedido) => {
    if (sessionStorage.getItem(chave)!==JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const antes=await supabase.auth.getUser();
    if(antes.error || antes.data.user?.id!==userId) throw new Error("Sessão alterada.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_anotar_os_reconciliacao",{
    p_request_id:p.requestId,p_cliente_id:p.clienteId,p_os_id:p.osId,p_updated_at:p.atualizadoEm,p_sync:p.sync,p_task_id:p.taskId,p_nota:p.nota});
    if(error) throw error; if(!data || data.requestId!==p.requestId || data.osId!==p.osId) throw new Error("Resposta inválida.");
    const depois=await supabase.auth.getUser();
    if(depois.error || depois.data.user?.id!==userId) throw new Error("Sessão alterada.");
  },onSuccess:async (_resultado,p) => {
    await Promise.all([cache.invalidateQueries({queryKey:["reconciliacao-os",userId,clienteId]}), cache.invalidateQueries({queryKey:["reconciliacao-os-notas",userId,clienteId]})]);
    try {if(sessionStorage.getItem(chave)!==JSON.stringify(p)) throw new Error("Tentativa divergente."); sessionStorage.removeItem(chave);} catch {setMensagem("Nota registrada; tentativa local mudou ou não pôde ser removida. Procure suporte.");return;}
    setPedido(null);setNota("");setMensagem("Nota interna registrada. Nenhuma ação remota foi realizada.");
  },onError:() => setMensagem("Resultado não confirmado. Repita mesmo pedido ou procure suporte."), onSettled:() => {enviando.current=false;}});
  function repetir(p:Pedido) {
    if(enviando.current) return;
    try {if(sessionStorage.getItem(chave)!==JSON.stringify(p)) throw new Error("Tentativa divergente."); enviando.current=true; envio.mutate(p);}
    catch {setMensagem("Tentativa local mudou ou está indisponível. Procure suporte.");}
  }
  return <section aria-label="Conferência de OS Auvo"><h3>OS e vínculo Auvo</h3>
    {import.meta.env.VITE_SSO_TRIAGEM_INTENCOES_REPROGRAMACAO_ENABLED === "true" && <IntencoesReprogramacao userId={userId} clienteId={clienteId} onAbrirOs={onAbrirOs} />}
    {import.meta.env.VITE_SSO_INBOX_OS_INCERTA_ENABLED === "true" && <InboxOsIncerta userId={userId} clienteId={clienteId} />}
    <p>Vínculo observado não confirma estado remoto; sem vínculo o resultado é incerto. Sem retentativa externa nesta tela.</p>
    {import.meta.env.VITE_SSO_CONFLITOS_PROPRIEDADE_OS_ENABLED === "true" && <ConflitosPropriedadeOs userId={userId} clienteId={clienteId} onAbrirOs={onAbrirOs} />}
    {import.meta.env.VITE_SSO_OBSERVAR_OS_RECONCILIACAO_ENABLED === "true" && <ObservarOrdens userId={userId} clienteId={clienteId}
      ordens={!ordens.isFetching && !ordens.isError ? (ordens.data?.pages.flat() ?? []) : []} disponivel={!!ordens.data && !ordens.isFetching && !ordens.isError} />}
    {ordens.isFetching && <output>Carregando OS…</output>}
    {ordens.isError && <p role="alert">Não foi possível consultar OS. <button type="button" onClick={() => void ordens.refetch()}>Tentar novamente</button></p>}
    {ordens.data && !ordens.isFetching && !ordens.isError && <ul>{ordens.data.pages.flat().map((o) => <li key={o.id}>
      OS {o.numero} · {o.status_operacional} · {o.status_sync ?? "sem estado"} · {o.classificacao} {o.auvo_task_id !== null && `· Auvo ${o.auvo_task_id}`}
      {onAbrirOs && <button type="button" onClick={() => onAbrirOs(o.id)}>Abrir contexto da OS</button>}
      <button type="button" onClick={() => setSelecionado(o.id)}>Anotar triagem</button>
      {selecionado===o.id && <form onSubmit={(event) => {event.preventDefault(); if(pedido || enviando.current || !nota.trim() || ordens.isFetching || ordens.isError) return;
        const p:Pedido={requestId:crypto.randomUUID(),clienteId,osId:o.id,atualizadoEm:o.atualizado_em,sync:o.status_sync,taskId:o.auvo_task_id,nota:nota.trim()};
        try {if(sessionStorage.getItem(chave)!==null){setMensagem("Há pedido anterior; reabra para recuperar.");return;}sessionStorage.setItem(chave,JSON.stringify(p));}
        catch {setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;} setPedido(p);enviando.current=true;envio.mutate(p);
      }}><label>Nota interna (sem credenciais ou dados sensíveis) <textarea required maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} disabled={!!pedido || envio.isPending}/></label>
        <button type="submit" disabled={!!pedido || envio.isPending}>Registrar</button></form>}
      {selecionado===o.id && <>
        {import.meta.env.VITE_SSO_OBSERVAR_OS_RECONCILIACAO_ENABLED === "true" && <HistoricoObservacaoOs userId={userId} clienteId={clienteId} osId={o.id} />}
        {import.meta.env.VITE_SSO_CONFLITOS_WEBHOOK_ENABLED === "true" && <ConflitosWebhook usuario={userId} cliente={clienteId} os={o.id} statusAtual={o.status_operacional} taskAtual={o.auvo_task_id} atualizadoEm={o.atualizado_em} />}
        {import.meta.env.VITE_SSO_EVIDENCIA_OS_RECONCILIACAO_ENABLED === "true" && <EvidenciasOs userId={userId} clienteId={clienteId} osId={o.id} />}
        {import.meta.env.VITE_SSO_EVIDENCIA_OS_RECONCILIACAO_ENABLED === "true" && <RevalidarIncertezaOs userId={userId} clienteId={clienteId} osId={o.id} />}
        {import.meta.env.VITE_SSO_SNAPSHOT_OS_RECONCILIACAO_ENABLED === "true" && <DiagnosticoSnapshotOs userId={userId} clienteId={clienteId} osId={o.id} />}
        {import.meta.env.VITE_SSO_EVIDENCIA_OS_RECONCILIACAO_ENABLED === "true" && <DeclararEvidenciaOs userId={userId} clienteId={clienteId} osId={o.id} atualizadoEm={o.atualizado_em} sync={o.status_sync} taskId={o.auvo_task_id} bloqueado={ordens.isFetching || ordens.isError} />}
        {notas.isFetching && <output>Carregando notas…</output>}
        {notas.isError && <p role="alert">Não foi possível carregar notas. <button type="button" onClick={() => void notas.refetch()}>Tentar novamente</button></p>}
        {!notas.isFetching && !notas.isError && <ul>{notas.data?.pages.flat().map((n) => <li key={n.request_id}>{n.criado_em} · {n.nota}</li>)}</ul>}
        {!notas.isError && notas.hasNextPage && <button type="button" disabled={notas.isFetching} onClick={() => void notas.fetchNextPage()}>Mais notas</button>}
      </>}
    </li>)}</ul>}
    {ordens.hasNextPage && <button type="button" onClick={() => void ordens.fetchNextPage()}>Mais OS</button>}
    {pedido==="invalido" && <p role="alert">Pedido ilegível. Procure suporte.</p>}
    {pedido && pedido!=="invalido" && <button type="button" disabled={envio.isPending} onClick={() => repetir(pedido)}>Repetir mesma nota</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
