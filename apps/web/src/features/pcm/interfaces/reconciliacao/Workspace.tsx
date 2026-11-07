import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { OrdensAuvo } from "./OrdensAuvo";
import { OrigensInternas } from "./OrigensInternas";
import { ExportarFila } from "./ExportarFila";
import { ResumoFila } from "./ResumoFila";
import { DiagnosticoFalhaFila } from "./DiagnosticoFalhaFila";
import { NotasFiltradas } from "./NotasFiltradas";
import { EstatisticasTriagem } from "./EstatisticasTriagem";
import { InconsistenciasFila } from "./InconsistenciasFila";
import { RevalidarPreviaFila } from "./RevalidarPreviaFila";
import { RevisaoLateralFila } from "./RevisaoLateralFila";
import { AcoesLocaisFila } from "./AcoesLocaisFila";
import { SolicitarRecuperacaoFila } from "./SolicitarRecuperacaoFila";
import { HistoricoSolicitacoesRecuperacao } from "./HistoricoSolicitacoesRecuperacao";
import { CoincidenciasFila } from "./CoincidenciasFila";
import { ObservarFila } from "./ObservarFila";
import { ObservarSelecaoFila } from "./ObservarSelecaoFila";
import { ProcessamentosDemorados } from "./ProcessamentosDemorados";
import { ConflitosPropriedadeFila } from "./ConflitosPropriedadeFila";
import { ReservasEnvioLegado } from "./ReservasEnvioLegado";

const itemSchema = z.object({
  id: z.string().guid(), entidade: z.enum(["sistemas", "equipamentos"]), objeto_id: z.string().guid(),
  operacao: z.string().min(1), estado: z.enum(["pendente", "incerto", "enviado_nao_confirmado"]),
  estado_fonte: z.enum(["pending", "processing", "error", "sent"]),
  tentativas: z.number().int().nonnegative().safe(),
  enfileirado_em: z.string().refine((v) => Number.isFinite(Date.parse(v))),
  enviado_em: z.string().refine((v) => Number.isFinite(Date.parse(v))).nullable(),
}).strict();
const notaSchema = z.object({
  request_id: z.string().guid(),
  ator_id: z.string().guid(),
  criado_em: z.string().refine((v) => Number.isFinite(Date.parse(v))),
  observacao: z.string().min(1).max(1000),
  status_observado: z.string(),
  tentativas_observadas: z.number().int().nonnegative().safe(),
}).strict();
const pedidoSchema = z.object({
  requestId: z.string().guid(), clienteId: z.string().guid(), outboxId: z.string().guid(),
  status: z.enum(["pending", "processing", "error", "sent"]),
  tentativas: z.number().int().nonnegative().safe(), observacao: z.string().trim().min(1).max(1000),
}).strict();
type Pedido = { requestId: string; clienteId: string; outboxId: string; status: string; tentativas: number; observacao: string };

const estadoOrigem: Record<z.infer<typeof itemSchema>["estado_fonte"], string> = {
  pending: "Pendente",
  processing: "Processando · resultado remoto incerto",
  error: "Falha registrada · resultado remoto incerto",
  sent: "Enviado · confirmação remota pendente",
};

async function exigirSessao(userId: string, signal?: AbortSignal) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
}

export function ReconciliacaoWorkspace({ userId, clienteId, onAbrirOs }: { userId: string; clienteId: string; onAbrirOs?: (osId: string) => void }) {
  const chave = `sso-reconciliacao-nota:${JSON.stringify([userId,clienteId])}`;
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [selecionado, setSelecionado] = useState("");
  const nota = rascunhos[selecionado] ?? "";
  const [mensagem, setMensagem] = useState("");
  const [estadoFila, setEstadoFila] = useState("");
  const [observados,setObservados]=useState<string[]>([]);
  const enviando = useRef(false);
  const filtroHabilitado = import.meta.env.VITE_SSO_FILTRO_RECONCILIACAO_ENABLED === "true";
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.clienteId === clienteId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const cache = useQueryClient();
  const itens = useInfiniteQuery({ queryKey: ["reconciliacao-outbox", userId, clienteId, filtroHabilitado ? estadoFila : ""], gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await exigirSessao(userId, signal);
      const requisicao = filtroHabilitado
        ? supabase.schema("pcm").rpc("sso_listar_outbox_reconciliacao_filtrada", { p_cliente_id: clienteId, p_estado: estadoFila || null, p_apos: pageParam, p_limite: 50 })
        : supabase.schema("pcm").rpc("sso_listar_outbox_reconciliacao", { p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50 });
      const { data,error } = await requisicao.abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(itemSchema).max(50).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        const esperado = item.estado_fonte === "pending" ? "pendente" : item.estado_fonte === "sent" ? "enviado_nao_confirmado" : "incerto";
        if ((anterior !== null && item.id.toLowerCase() <= anterior) || item.estado !== esperado ||
          (filtroHabilitado && estadoFila && item.estado_fonte !== estadoFila)) throw new Error("Página divergente.");
        anterior = item.id.toLowerCase();
      }
      await exigirSessao(userId, signal);
      return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.id : undefined,
  });
  const notas = useInfiniteQuery({ queryKey: ["reconciliacao-notas",userId,clienteId,selecionado], enabled: !!selecionado, gcTime: 0,
    initialPageParam: null as { data: string; id: string } | null,
    queryFn: async ({pageParam,signal}) => {
      await exigirSessao(userId, signal);
      const { data,error } = await supabase.schema("pcm").rpc("sso_listar_notas_outbox",{
        p_cliente_id: clienteId,p_outbox_id: selecionado,p_apos: pageParam?.data ?? null,p_apos_id: pageParam?.id ?? null,p_limite: 50 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(notaSchema).max(50).parse(data);
      if (new Set(pagina.map((n) => n.request_id)).size !== pagina.length) throw new Error("Página divergente.");
      await exigirSessao(userId, signal);
      return pagina;
    }, getNextPageParam: (pagina) => { const ultima = pagina.at(-1); return pagina.length === 50 && ultima ? {data: ultima.criado_em,id: ultima.request_id} : undefined; },
  });
  const itensCarregados = itens.data?.pages.flat() ?? [];
  const itensDivergentes = itensCarregados.some((item, indice) => indice > 0 &&
    item.id.toLowerCase() <= itensCarregados[indice - 1]!.id.toLowerCase());
  const notasCarregadas = notas.data?.pages.flat() ?? [];
  const notasDivergentes = new Set(notasCarregadas.map((item) => item.request_id.toLowerCase())).size !== notasCarregadas.length;
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    pedidoSchema.parse(p);
    if (p.clienteId !== clienteId) throw new Error("Cliente divergente.");
    await exigirSessao(userId);
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data,error } = await supabase.schema("pcm").rpc("sso_anotar_outbox_reconciliacao",{
      p_request_id:p.requestId,p_cliente_id:p.clienteId,p_outbox_id:p.outboxId,p_status_esperado:p.status,
      p_tentativas_esperadas:p.tentativas,p_observacao:p.observacao });
    if (error) throw error;
    if (!data || data.requestId !== p.requestId || data.outboxId !== p.outboxId) throw new Error("Resposta inválida.");
    await exigirSessao(userId);
  }, onSuccess: async (_resultado, p) => { let limpa = false;
    await cache.invalidateQueries({queryKey:["reconciliacao-notas",userId,clienteId]});
    await cache.invalidateQueries({queryKey:["reconciliacao-notas-filtradas",userId,clienteId]});
    await cache.invalidateQueries({queryKey:["reconciliacao-estatisticas-triagem",userId,clienteId]});
    try { await exigirSessao(userId); if (sessionStorage.getItem(chave) === JSON.stringify(p)) { sessionStorage.removeItem(chave); limpa = true; } } catch { /* Preservar tentativa quando sessão ou armazenamento falha. */ }
    if (limpa) {
      setPedido(null);
      setRascunhos((atuais) => {
        if (atuais[p.outboxId]?.trim() !== p.observacao) return atuais;
        const proximos = { ...atuais };
        delete proximos[p.outboxId];
        return proximos;
      });
      setMensagem("Nota interna registrada. A fila e o destino não foram alterados.");
    }
    else setMensagem("Nota registrada, mas sessão ou tentativa local mudou. Procure suporte.");
  }, onError: () => setMensagem("Resultado não confirmado. Repita mesmo pedido ou procure suporte antes de outra ação."),
  onSettled: () => { enviando.current = false; } });
  function repetir(p: Pedido) {
    if (enviando.current) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente");
      enviando.current = true;
      enviar.mutate(p);
    } catch { setMensagem("Tentativa local mudou ou está indisponível. Procure suporte antes de repetir."); }
  }
  return <section aria-label="Conferência de integração Auvo">
    <h2>Conferência de integração Auvo</h2>
    <OrdensAuvo userId={userId} clienteId={clienteId} onAbrirOs={onAbrirOs} />
    {import.meta.env.VITE_SSO_RESERVAS_ENVIO_LEGADO_ENABLED === "true" && <ReservasEnvioLegado key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} onAbrirOs={onAbrirOs} />}
    <OrigensInternas userId={userId} clienteId={clienteId} onAbrirOs={onAbrirOs} />
    <p>Somente Sistemas e Componentes com Cliente comprovado. Processamento ou falha podem ter resultado remoto incerto; enviado não significa confirmado. Não há retentativa ou correção externa.</p>
    {import.meta.env.VITE_SSO_RESUMO_RECONCILIACAO_ENABLED === "true" && <ResumoFila userId={userId} clienteId={clienteId} />}
    {import.meta.env.VITE_SSO_PROCESSAMENTOS_DEMORADOS_ENABLED === "true" && <ProcessamentosDemorados userId={userId} clienteId={clienteId} />}
    {import.meta.env.VITE_SSO_CONFLITOS_PROPRIEDADE_FILA_ENABLED === "true" && <ConflitosPropriedadeFila key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} />}
    {import.meta.env.VITE_SSO_ESTATISTICAS_TRIAGEM_ENABLED === "true" && <EstatisticasTriagem userId={userId} clienteId={clienteId} />}
    {import.meta.env.VITE_SSO_INCONSISTENCIAS_FILA_ENABLED === "true" && <InconsistenciasFila userId={userId} clienteId={clienteId} />}
    {import.meta.env.VITE_SSO_COINCIDENCIAS_FILA_ENABLED === "true" && <CoincidenciasFila userId={userId} clienteId={clienteId} />}
    {filtroHabilitado && <label>Estado da fila <select value={estadoFila} onChange={(e) => { setEstadoFila(e.target.value); setSelecionado(""); setObservados([]); }}><option value="">Todos</option><option value="pending">Pendente</option><option value="processing">Processando (remoto incerto)</option><option value="error">Erro (remoto incerto)</option><option value="sent">Enviado (não confirmado)</option></select></label>}
    {filtroHabilitado && import.meta.env.VITE_SSO_EXPORTAR_RECONCILIACAO_ENABLED === "true" && <ExportarFila userId={userId} clienteId={clienteId} estado={estadoFila} />}
    {import.meta.env.VITE_SSO_OBSERVACAO_FILA_LOTE_ENABLED === "true" && <ObservarSelecaoFila userId={userId} clienteId={clienteId} selecionados={itensDivergentes || itens.isFetching || itens.isError ? [] : observados} limparSelecao={()=>setObservados([])} />}
    {itens.isFetching && <output>Carregando integrações…</output>}
    {itens.isError && <p role="alert">Não foi possível consultar. <button type="button" onClick={() => void itens.refetch()}>Tentar novamente</button></p>}
    {itensDivergentes && <p role="alert">A fila mudou durante a consulta. <button type="button" onClick={() => void itens.refetch()}>Atualizar fila</button></p>}
    {itens.data && !itens.isFetching && !itens.isError && !itensDivergentes && <ul>{itensCarregados.map((i) => <li key={i.id}>
      {import.meta.env.VITE_SSO_OBSERVACAO_FILA_LOTE_ENABLED === "true" && <label><input type="checkbox" checked={observados.includes(i.id)} disabled={!observados.includes(i.id)&&observados.length>=50} onChange={(e)=>setObservados((atuais)=>e.target.checked?[...atuais,i.id]:atuais.filter((id)=>id!==i.id))} /> Selecionar para observação</label>}
      {i.entidade} {i.objeto_id} · {i.operacao} · {estadoOrigem[i.estado_fonte]} · {i.tentativas} tentativa(s) · criado {i.enfileirado_em}{i.enviado_em && <> · envio registrado {i.enviado_em}</>}
      <button type="button" onClick={() => setSelecionado(i.id)}>Conferir notas</button>
      {selecionado === i.id && <form onSubmit={(e) => {
        e.preventDefault(); if (pedido || enviando.current || !nota.trim() || itens.isFetching || itens.isError) return;
        const p: Pedido = {requestId:crypto.randomUUID(),clienteId,outboxId:i.id,status:i.estado_fonte,tentativas:i.tentativas,observacao:nota.trim()};
        try { if (sessionStorage.getItem(chave) !== null) {setMensagem("Há tentativa anterior na sessão; reabra para recuperar."); return;} sessionStorage.setItem(chave,JSON.stringify(p)); }
        catch {setMensagem("Não foi possível guardar tentativa; nada foi enviado.");return;}
        enviando.current = true; setPedido(p); enviar.mutate(p);
      }}><label>Nota interna (não inclua credenciais ou dados sensíveis) <textarea required maxLength={1000} value={nota} onChange={(e) => { const valor = e.target.value; setRascunhos((atuais) => ({ ...atuais, [i.id]: valor })); }} disabled={!!pedido || enviar.isPending} /></label><button type="submit" disabled={!!pedido || enviar.isPending}>Registrar nota</button></form>}
      {selecionado === i.id && <>
        {import.meta.env.VITE_SSO_OBSERVACAO_FILA_ENABLED === "true" && <ObservarFila userId={userId} clienteId={clienteId} outboxId={i.id} />}
        {import.meta.env.VITE_SSO_DIAGNOSTICO_FALHA_FILA_ENABLED === "true" && <DiagnosticoFalhaFila userId={userId} clienteId={clienteId} outboxId={i.id} />}
        {import.meta.env.VITE_SSO_REVALIDAR_PREVIA_FILA_ENABLED === "true" && <RevalidarPreviaFila userId={userId} clienteId={clienteId} outboxId={i.id} estado={i.estado_fonte} tentativas={i.tentativas} />}
        {import.meta.env.VITE_SSO_REVISAO_LATERAL_FILA_ENABLED === "true" && <RevisaoLateralFila userId={userId} clienteId={clienteId} outboxId={i.id} />}
        {import.meta.env.VITE_SSO_ACOES_LOCAIS_FILA_ENABLED === "true" && <AcoesLocaisFila userId={userId} clienteId={clienteId} outboxId={i.id} />}
        <SolicitarRecuperacaoFila userId={userId} clienteId={clienteId} outboxId={i.id} />
        <HistoricoSolicitacoesRecuperacao userId={userId} clienteId={clienteId} outboxId={i.id} />
        {import.meta.env.VITE_SSO_FILTRO_NOTAS_FILA_ENABLED === "true" && <NotasFiltradas userId={userId} clienteId={clienteId} outboxId={i.id} />}
        {notas.isFetching && <output>Carregando notas…</output>}
        {notas.isError && <p role="alert">Não foi possível carregar notas. <button type="button" onClick={() => void notas.refetch()}>Tentar novamente</button></p>}
        {notasDivergentes && <p role="alert">O histórico mudou durante a consulta. <button type="button" onClick={() => void notas.refetch()}>Atualizar notas</button></p>}
        {!notas.isFetching && !notas.isError && !notasDivergentes && <ul>{notasCarregadas.map((n) => <li key={n.request_id}>{n.criado_em} · {n.observacao}</li>)}</ul>}
        {notas.hasNextPage && !notasDivergentes && <button type="button" disabled={notas.isFetching || notas.isError} onClick={() => void notas.fetchNextPage()}>Mais notas</button>}
      </>}
    </li>)}</ul>}
    {itens.hasNextPage && !itensDivergentes && <button type="button" disabled={itens.isFetching || itens.isError} onClick={() => void itens.fetchNextPage()}>Mais itens</button>}
    {pedido === "invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    {pedido && pedido !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => repetir(pedido)}>Repetir mesma nota</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
