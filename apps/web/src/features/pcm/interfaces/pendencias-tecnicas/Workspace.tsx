import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { Composicoes } from "./Composicoes";
import { PublicarPendenciaPortal } from "./PublicarPendenciaPortal";
import { DiagnosticoResolucao } from "./DiagnosticoResolucao";
import { ResolucaoHumana } from "./ResolucaoHumana";
import { HistoricoResolucaoAtivo } from "./HistoricoResolucaoAtivo";
import { CriticidadePendencia } from "./CriticidadePendencia";
import { ContextoTecnico } from "./ContextoTecnico";
import { RevisaoCondicaoResolvida } from "./RevisaoCondicaoResolvida";
import { HistoricoPublicacaoPortal } from "./HistoricoPublicacaoPortal";
import { RastreabilidadePendencia } from "./RastreabilidadePendencia";
import { CondicoesNaoInformadas } from "./CondicoesNaoInformadas";
import { FiltroCriticidade } from "./FiltroCriticidade";
import { FiltroContextoTecnico } from "./FiltroContextoTecnico";
import { PreviaSelecao } from "./PreviaSelecao";
import { EvidenciasOrigem } from "./EvidenciasOrigem";
import { ResultadosAtivo } from "./ResultadosAtivo";
import { ResolucaoFotoManual } from "./ResolucaoFotoManual";

const linhaSchema = z.object({ id: z.string().guid(), alvo_tipo: z.enum(["sistema", "componente", "grupo"]),
  alvo_id: z.string().guid(), alvo_nome: z.string().nullable(), pergunta: z.string(), observacao: z.string().nullable(),
  estado: z.enum(["aberta", "risco_aceito", "dispensada", "duplicada", "resolvida"]), revisao: z.number().int().positive(),
  criado_em: z.string().datetime({ offset: true }) }).strict();
type Linha = z.infer<typeof linhaSchema>;
const pedidoSchema = z.object({ requestId: z.string().guid(), pendenciaId: z.string().guid(), revision: z.number().int().positive(),
  decisao: z.enum(["risco_aceito", "dispensada", "duplicada", "reaberta"]), motivo: z.string().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const respostaSchema = z.object({ pendenciaId: z.string().guid(), requestId: z.string().guid(), revision: z.number().int().positive(),
  estado: z.enum(["aberta", "risco_aceito", "dispensada", "duplicada", "resolvida"]) }).strict();

/** A flag e os comandos no banco permanecem fechados até revisão e integração completas. */
export function PendenciasTecnicasWorkspace(props: { userId: string; clienteId: string }) {
  if (import.meta.env.VITE_SSO_PENDENCIAS_TECNICAS_ENABLED !== "true") return null;
  return <Permissao key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Permissao(props: { userId: string; clienteId: string }) {
  const permissao = useQuery({ queryKey: ["pendencias-tecnicas", props.userId, props.clienteId, "permissao"],
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("execucao.validar", props.clienteId), gcTime: 0, refetchOnWindowFocus: true });
  if (permissao.isPending || permissao.isFetching) return <output>Verificando acesso às pendências…</output>;
  if (permissao.isError) return <p role="alert">Não foi possível verificar acesso. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  return permissao.data === true ? <Lista {...props} /> : null;
}
function Lista({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [selecionadas, setSelecionadas] = useState<Record<string, number>>({});
  const [buscaAtivo, setBuscaAtivo] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const filtroServidor = import.meta.env.VITE_SSO_PENDENCIAS_FILTRO_ATIVO_ENABLED === "true";
  const lista = useInfiniteQuery({ queryKey: ["pendencias-tecnicas", userId, clienteId, "lista", filtroServidor ? buscaAplicada : null], gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const requisicao = filtroServidor
        ? supabase.schema("pcm").rpc("sso_listar_pendencias_por_ativo", { p_cliente_id: clienteId, p_busca: buscaAplicada, p_apos: pageParam, p_limite: 20 })
        : supabase.schema("pcm").rpc("sso_listar_pendencias_contexto_mediado", { p_cliente_id: clienteId, p_apos: pageParam, p_limite: 20 });
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linhaSchema).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        if (anterior !== null && item.id.toLowerCase() <= anterior) throw new Error("Página inválida.");
        anterior = item.id.toLowerCase();
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const dadosCarregados = lista.data?.pages.flat() ?? [];
  const itensVisiveis = !lista.isFetching && !lista.isError ? dadosCarregados : [];
  const alvoSelecionado = itensVisiveis.find(p => selecionadas[p.id] !== undefined);
  const agrupados = new Map<string, { nome: string; itens: Linha[] }>();
  for (const item of dadosCarregados) {
    const chave = JSON.stringify([item.alvo_tipo, item.alvo_id.toLowerCase()]);
    const grupo = agrupados.get(chave) ?? { nome: `${item.alvo_tipo} · ${item.alvo_nome ?? item.alvo_id}`, itens: [] };
    grupo.itens.push(item);
    agrupados.set(chave, grupo);
  }
  const itensSelecionados = Object.entries(selecionadas);
  const buscaNormalizada = filtroServidor ? "" : buscaAtivo.trim().toLocaleLowerCase("pt-BR");
  const gruposVisiveis = [...agrupados.entries()].filter(([, grupo]) =>
    !buscaNormalizada || grupo.nome.toLocaleLowerCase("pt-BR").includes(buscaNormalizada) ||
    grupo.itens.some((item) => item.alvo_id.toLowerCase().includes(buscaNormalizada)),
  );
  const selecaoConferida = !lista.isFetching && !lista.isError && !!alvoSelecionado &&
    itensSelecionados.every(([id, revision]) => lista.data?.pages.flat().some(p =>
      p.id === id && p.revisao === revision && p.estado === "aberta" &&
      p.alvo_tipo === alvoSelecionado.alvo_tipo && p.alvo_id === alvoSelecionado.alvo_id));
  return <section><h2>Pendências técnicas</h2><p>Resultados explícitos Não OK de retornos aprovados. A lista ainda não contém evidências ou fontes anteriores ao novo fluxo.</p>
    {alvoSelecionado && <p>Seleção atual: {alvoSelecionado.alvo_tipo} · {alvoSelecionado.alvo_nome ?? alvoSelecionado.alvo_id}. Apenas Pendências deste alvo podem ser agrupadas.</p>}
    {itensSelecionados.length > 0 && !selecaoConferida && <button type="button" onClick={() => setSelecionadas({})}>Limpar seleção</button>}
    <PreviaSelecao userId={userId} clienteId={clienteId} selecionadas={selecionadas} />
    <CondicoesNaoInformadas userId={userId} clienteId={clienteId} alvos={itensVisiveis} />
    <FiltroCriticidade userId={userId} clienteId={clienteId} />
    <FiltroContextoTecnico userId={userId} clienteId={clienteId} />
    <ResultadosAtivo userId={userId} clienteId={clienteId} alvos={itensVisiveis} />
    {filtroServidor ? <form onSubmit={(e) => { e.preventDefault(); setBuscaAplicada(buscaAtivo.trim()); }}><label>Buscar ativo <input value={buscaAtivo} maxLength={120} onChange={(e) => setBuscaAtivo(e.target.value)} /></label><button type="submit">Buscar</button>{buscaAtivo.trim() !== buscaAplicada && <p>Busca editada; confirme para atualizar os resultados.</p>}</form> : <label>Filtrar ativo nas páginas carregadas <input value={buscaAtivo} maxLength={200} onChange={(e) => setBuscaAtivo(e.target.value)} /></label>}
    {buscaNormalizada && !lista.isFetching && !lista.isError && <p>{gruposVisiveis.length} ativo(s) encontrados nas páginas carregadas{lista.hasNextPage ? "; carregue mais para ampliar a busca" : ""}. A seleção de pendências é preservada.</p>}
    {import.meta.env.VITE_SSO_BACKLOG_COMPOSICAO_ENABLED === "true" && <ComporBacklog userId={userId} clienteId={clienteId} selecionadas={selecionadas} selecaoConferida={selecaoConferida} limpar={() => setSelecionadas({})} />}
    {import.meta.env.VITE_SSO_BACKLOG_COMPOSICAO_ENABLED === "true" && <Composicoes userId={userId} clienteId={clienteId} />}
    {lista.isFetching && <output>Carregando pendências…</output>}
    {lista.isError && <p role="alert">Não foi possível carregar pendências. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isFetching && !lista.isError && lista.data && itensVisiveis.length === 0 && <p>Nenhuma pendência encontrada nesta fonte.</p>}
    {!lista.isFetching && !lista.isError && itensVisiveis.length > 0 && <p>Contagens abaixo consideram apenas as páginas carregadas{lista.hasNextPage ? "; há mais pendências para carregar" : ""}.</p>}
    <div hidden={lista.isFetching || lista.isError}>{[...agrupados.entries()].map(([chave, grupo]) => <section key={chave} hidden={!gruposVisiveis.some(([visivel]) => visivel === chave)} aria-label={`Pendências de ${grupo.nome}`}><h3>{grupo.nome} · {grupo.itens.length} carregada(s)</h3>{grupo.itens.map((item) => <div key={item.id}>
      {import.meta.env.VITE_SSO_BACKLOG_COMPOSICAO_ENABLED === "true" && (item.estado === "aberta" || selecionadas[item.id] !== undefined) && <label><input type="checkbox" checked={selecionadas[item.id] !== undefined} disabled={selecionadas[item.id] === undefined && !!alvoSelecionado && (alvoSelecionado.alvo_tipo !== item.alvo_tipo || alvoSelecionado.alvo_id !== item.alvo_id)} onChange={(e) => setSelecionadas((atual) => {
        const proxima = { ...atual }; if (e.target.checked) proxima[item.id] = item.revisao; else delete proxima[item.id]; return proxima;
      })} /> Selecionar pendência para composição</label>}
      {selecionadas[item.id] !== undefined && selecionadas[item.id] !== item.revisao && <p role="alert">Pendência alterada desde a seleção. Desmarque e selecione novamente após conferir a revisão.</p>}
      <Decidir item={item} userId={userId} clienteId={clienteId} />
      <RastreabilidadePendencia userId={userId} clienteId={clienteId} pendenciaId={item.id} />
      <EvidenciasOrigem userId={userId} clienteId={clienteId} pendenciaId={item.id} />
      <ResolucaoFotoManual userId={userId} clienteId={clienteId} pendenciaId={item.id} revisao={item.revisao} aberta={item.estado === "aberta"} criadaEm={item.criado_em} />
    </div>)}</section>)}</div>
    {!lista.isError && lista.hasNextPage && <button type="button" disabled={lista.isFetchingNextPage} onClick={() => void lista.fetchNextPage()}>Carregar mais</button>}
  </section>;
}
const pedidoComposicaoSchema = z.object({ requestId: z.string().guid(), clienteId: z.string().guid(),
  itens: z.array(z.object({ id: z.string().guid(), revision: z.number().int().positive() }).strict()).min(1).max(100) }).strict();
type PedidoComposicao = z.infer<typeof pedidoComposicaoSchema>;
function ComporBacklog({ userId, clienteId, selecionadas, selecaoConferida, limpar }: { userId: string; clienteId: string; selecionadas: Record<string, number>; selecaoConferida: boolean; limpar: () => void }) {
  const chave = `sso-backlog-composicao:${JSON.stringify([userId, clienteId])}`;
  const [pendente, setPendente] = useState<PedidoComposicao | "invalido" | null>(() => { try {
    const texto = sessionStorage.getItem(chave); if (!texto) return null;
    const p = pedidoComposicaoSchema.parse(JSON.parse(texto)); return p.clienteId === clienteId ? p : "invalido";
  } catch { return "invalido"; } });
  const [aviso, setAviso] = useState(""); const enviando = useRef(false); const client = useQueryClient();
  const envio = useMutation({ mutationFn: async (p: PedidoComposicao) => {
    const { data, error } = await supabase.schema("pcm").rpc("sso_compor_backlog_pendencias", {
      p_request_id: p.requestId, p_cliente_id: p.clienteId, p_itens: p.itens,
    });
    if (error) throw error;
    const resposta = z.object({ aggregateId: z.string().guid(), revision: z.literal(1), state: z.literal("aguardando"),
      created: z.literal(true), linkedIds: z.object({ pendencias: z.array(z.object({ id: z.string().guid(), revision: z.number().int().positive() }).strict()) }).strict(),
      warnings: z.array(z.string()), requestId: z.string().guid() }).strict().parse(data);
    if (resposta.requestId !== p.requestId || JSON.stringify(resposta.linkedIds.pendencias) !== JSON.stringify(p.itens)) throw new Error("Resposta divergente");
    return resposta;
  }, onSuccess: async (_r, p) => {
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Composição registrada, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); limpar(); setAviso("Composição registrada, sem criar Chamado ou OS.");
    await client.invalidateQueries({ queryKey: ["pendencias-tecnicas", userId, clienteId, "lista"] });
    await client.invalidateQueries({ queryKey: ["backlog-composicoes", userId, clienteId] });
  }, onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),
  onSettled: () => { enviando.current = false; } });
  function enviar(p: PedidoComposicao) {
    if (enviando.current) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); }
    catch { setAviso("Tentativa local indisponível ou alterada. Consulte suporte."); return; }
    enviando.current = true; setAviso(""); envio.mutate(p);
  }
  function iniciar() { if (pendente || enviando.current || !selecaoConferida) return; try {
    const itens = Object.entries(selecionadas).sort(([a], [b]) => a.localeCompare(b)).map(([id, revision]) => ({ id, revision }));
    const p = pedidoComposicaoSchema.parse({ requestId: crypto.randomUUID(), clienteId, itens });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
    sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Selecione de 1 a 100 pendências e confira a sessão. Nada foi enviado."); } }
  return <section aria-label="Composição do Backlog"><p>{Object.keys(selecionadas).length} selecionada(s). A composição exige mesmo alvo e não cria Chamado ou OS.</p>
    {Object.keys(selecionadas).length > 0 && !selecaoConferida && <p>Confira a lista atual e refaça seleções alteradas ou indisponíveis antes de compor.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir composição</button> :
      !pendente && <button type="button" disabled={envio.isPending || !selecaoConferida} onClick={iniciar}>Compor Backlog</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
function Decidir({ item, userId, clienteId }: { item: Linha; userId: string; clienteId: string }) {
  const chave = `sso-pendencia-decisao:${JSON.stringify([userId, clienteId, item.id])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const texto = sessionStorage.getItem(chave); if (!texto) return null;
    const pedido = pedidoSchema.parse(JSON.parse(texto)); return pedido.pendenciaId === item.id ? pedido : "invalido";
  } catch { return "invalido"; } });
  const [decisao, setDecisao] = useState<Pedido["decisao"]>(item.estado === "aberta" ? "risco_aceito" : "reaberta");
  const [motivo, setMotivo] = useState("");
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [aviso, setAviso] = useState("");
  const enviando = useRef(false); const client = useQueryClient();
  const historico = useInfiniteQuery({ queryKey: ["pendencias-tecnicas", userId, clienteId, item.id, "historico", item.revisao],
    enabled: mostrarHistorico, gcTime: 0, initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_decisoes_pendencia", {
        p_pendencia_id: item.id, p_apos: pageParam, p_limite: 20,
      }).abortSignal(signal);
      if (error) throw error;
      return z.array(z.object({ revisao: z.number().int().positive(), decisao: z.string(), motivo: z.string(),
        ator_id: z.string().guid(), ocorrido_em: z.string().datetime({ offset: true }) }).strict()).max(20).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.revisao : undefined });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_decidir_pendencia", { p_request_id: p.requestId,
      p_pendencia_id: p.pendenciaId, p_revision: p.revision, p_decisao: p.decisao, p_motivo: p.motivo });
    if (error) throw error;
    const resposta = respostaSchema.parse(data);
    if (resposta.requestId !== p.requestId || resposta.pendenciaId !== p.pendenciaId || resposta.revision !== p.revision + 1 ||
      resposta.estado !== (p.decisao === "reaberta" ? "aberta" : p.decisao)) throw new Error("Resposta divergente");
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    return resposta;
  }, onSuccess: async (_r, p) => {
    try {
      await client.invalidateQueries({ queryKey: ["pendencias-tecnicas", userId, clienteId, "lista"] });
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente");
      sessionStorage.removeItem(chave);
    }
    catch { setAviso("Decisão registrada, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setMotivo(""); setAviso("Decisão registrada.");
  }, onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),
  onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) {
    if (enviando.current) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); }
    catch { setAviso("Tentativa local indisponível ou alterada. Consulte suporte."); return; }
    enviando.current = true; setAviso(""); envio.mutate(p);
  }
  function iniciar() { if (pendente || enviando.current) return; try {
    if (item.estado === "aberta" ? decisao === "reaberta" : decisao !== "reaberta") throw new Error("Decisão incompatível com estado atual.");
    const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), pendenciaId: item.id, revision: item.revisao, decisao, motivo: motivo.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
    sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira o motivo e a sessão. Nada foi enviado."); } }
  return <article><h3>{item.alvo_tipo} · {item.alvo_nome ?? "Nome indisponível"} · {item.alvo_id}</h3><p>Pergunta {item.pergunta} · {item.estado} · revisão {item.revisao}</p>
    {item.observacao && <p>Observação: {item.observacao}</p>}
    <p>Fotos, executor e data da execução não estão disponíveis nesta fonte.</p>
    {import.meta.env.VITE_SSO_PORTAL_PENDENCIAS_PUBLICACAO_ENABLED === "true" && <PublicarPendenciaPortal key={`${item.id}:${item.revisao}`} userId={userId} clienteId={clienteId} pendenciaId={item.id} revisao={item.revisao} />}
    <DiagnosticoResolucao userId={userId} clienteId={clienteId} pendenciaId={item.id} revisao={item.revisao} />
    <HistoricoResolucaoAtivo userId={userId} clienteId={clienteId} alvoTipo={item.alvo_tipo} alvoId={item.alvo_id} />
    <CriticidadePendencia userId={userId} clienteId={clienteId} pendenciaId={item.id} revisao={item.revisao} alvoTipo={item.alvo_tipo} alvoId={item.alvo_id} />
    <ContextoTecnico userId={userId} clienteId={clienteId} pendenciaId={item.id} revisao={item.revisao} />
    {item.estado === "resolvida" && <RevisaoCondicaoResolvida userId={userId} clienteId={clienteId} pendenciaId={item.id} revisao={item.revisao} />}
    <ResolucaoHumana userId={userId} clienteId={clienteId} pendenciaId={item.id} revisao={item.revisao} aberta={item.estado === "aberta"} />
    {import.meta.env.VITE_SSO_PORTAL_PENDENCIAS_PUBLICACAO_ENABLED === "true" && <HistoricoPublicacaoPortal userId={userId} clienteId={clienteId} pendenciaId={item.id} revisao={item.revisao} />}
    <button type="button" onClick={() => setMostrarHistorico((valor) => !valor)}>{mostrarHistorico ? "Ocultar histórico" : "Ver histórico de decisões"}</button>
    {mostrarHistorico && historico.isPending && <output>Carregando histórico…</output>}
    {mostrarHistorico && historico.isError && <p role="alert">Não foi possível consultar o histórico. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
    {mostrarHistorico && !historico.isError && historico.data?.pages.flat().length === 0 && <p>Nenhuma decisão registrada.</p>}
    {mostrarHistorico && !historico.isError && <ul>{historico.data?.pages.flat().map((d) => <li key={d.revisao}>
      Revisão {d.revisao} · {d.decisao} · {new Date(d.ocorrido_em).toLocaleString("pt-BR")} · responsável {d.ator_id} · {d.motivo}
    </li>)}</ul>}
    {mostrarHistorico && historico.hasNextPage && <button type="button" disabled={historico.isFetchingNextPage} onClick={() => void historico.fetchNextPage()}>Mais decisões</button>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir decisão</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Decisão <select value={decisao} onChange={(e) => setDecisao(e.target.value as Pedido["decisao"])}>
          {item.estado === "aberta" ? <><option value="risco_aceito">Aceitar risco</option><option value="dispensada">Dispensar</option><option value="duplicada">Marcar duplicidade</option></> : <option value="reaberta">Reabrir</option>}
        </select></label>
        <label>Justificativa <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <button type="submit" disabled={envio.isPending}>Registrar decisão</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </article>;
}
