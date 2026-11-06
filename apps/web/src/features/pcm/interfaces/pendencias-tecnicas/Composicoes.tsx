import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { VinculoChamado } from "./VinculoChamado";
import { DiagnosticoComposicoesVazias } from "./DiagnosticoComposicoesVazias";
import { EscopoEvidencias } from "./EscopoEvidencias";
import { HistoricoSelecao } from "./HistoricoSelecao";
import { PromoverComposicao } from "./PromoverComposicao";
import { DividirComposicao } from "./DividirComposicao";

const itemSchema = z.object({ id: z.string().uuid(), alvo_tipo: z.string(), alvo_id: z.string().uuid(), revisao: z.number().int().positive(),
  gravidade: z.number().nullable(), urgencia: z.number().nullable(), tendencia: z.number().nullable(), dor_cliente: z.number().nullable(),
  score: z.number().finite().nullable(), total: z.number().int().nonnegative(), criado_em: z.string().datetime({ offset: true }) }).strict();
type Item = z.infer<typeof itemSchema>;
type ItemRanking = Item & { assinatura: string | null };
type CursorRanking = { id: string; score: number | null; assinatura: string | null } | null;
function validarPaginaRanking(pagina: ItemRanking[], cursor: CursorRanking, filtro: { tipo: string; id: string } | null, consistente: boolean): ItemRanking[] {
  let anterior = cursor;
  let assinatura = cursor?.assinatura ?? null;
  for (const item of pagina) {
    if (filtro && (item.alvo_tipo !== filtro.tipo || item.alvo_id.toLowerCase() !== filtro.id.toLowerCase())) throw new Error("Alvo divergente.");
    if (consistente) {
      if (!item.assinatura || (assinatura !== null && assinatura !== item.assinatura)) throw new Error("Ranking alterado.");
      assinatura = item.assinatura;
    }
    if (anterior) {
      const empate = item.score === anterior.score;
      if ((anterior.score === null && item.score !== null) ||
        (anterior.score !== null && item.score !== null && item.score > anterior.score) ||
        (empate && item.id.toLowerCase() <= anterior.id.toLowerCase())) throw new Error("Ordem inválida.");
    }
    anterior = { id: item.id, score: item.score, assinatura: item.assinatura };
  }
  return pagina;
}
const pedidoSchema = z.object({ requestId: z.string().uuid(), id: z.string().uuid(), revisao: z.number().int().positive(),
  g: z.number().int().min(1).max(5), u: z.number().int().min(1).max(5), t: z.number().int().min(1).max(5),
  d: z.number().int().min(1).max(5).nullable(), motivo: z.string().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function Composicoes({ userId, clienteId }: { userId: string; clienteId: string }) {
  const rankingConsistente = import.meta.env.VITE_SSO_RANKING_BACKLOG_CONSISTENTE_ENABLED === "true";
  const filtroHabilitado = rankingConsistente && import.meta.env.VITE_SSO_RANKING_BACKLOG_ALVO_ENABLED === "true";
  const [alvoTipo, setAlvoTipo] = useState("sistema"); const [alvoId, setAlvoId] = useState("");
  const [filtro, setFiltro] = useState<{ tipo: string; id: string } | null>(null); const [erroFiltro, setErroFiltro] = useState("");
  const [divididaId, setDivididaId] = useState<string | null>(null);
  const client = useQueryClient();
  const dividida = useQuery({ queryKey: ["backlog-composicao-direta", userId, clienteId, divididaId], enabled: !!divididaId, gcTime: 0, queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_composicao_backlog", { p_cliente_id: clienteId, p_composicao_id: divididaId }).abortSignal(signal); if (error) throw error; const itens = z.array(itemSchema).max(1).parse(data); const item = itens[0]; if (itens.length !== 1 || !item || item.id !== divididaId) throw new Error("Composição indisponível."); return item; } });
  const lista = useInfiniteQuery({ queryKey: ["backlog-composicoes", userId, clienteId, rankingConsistente, filtro], gcTime: 0,
    initialPageParam: null as { id: string; score: number | null; assinatura: string | null } | null,
    queryFn: async ({ pageParam, signal }) => {
      if (filtro) {
        const { data, error } = await supabase.schema("pcm").rpc("sso_listar_ranking_backlog_por_alvo", { p_cliente_id: clienteId,
          p_alvo_tipo: filtro.tipo, p_alvo_id: filtro.id, p_limite: 20, p_apos_id: pageParam?.id ?? null,
          p_apos_score: pageParam?.score ?? null, p_assinatura: pageParam?.assinatura ?? null }).abortSignal(signal);
        if (error) throw error;
        return validarPaginaRanking(z.array(itemSchema.extend({ assinatura: z.string().length(32) })).max(20).parse(data), pageParam, filtro, true);
      }
      if (rankingConsistente) {
        const { data, error } = await supabase.schema("pcm").rpc("sso_listar_ranking_backlog_consistente", { p_cliente_id: clienteId,
          p_limite: 20, p_apos_id: pageParam?.id ?? null, p_apos_score: pageParam?.score ?? null, p_assinatura: pageParam?.assinatura ?? null }).abortSignal(signal);
        if (error) throw error;
        return validarPaginaRanking(z.array(itemSchema.extend({ assinatura: z.string().length(32) })).max(20).parse(data), pageParam, null, true);
      }
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_composicoes_backlog", { p_cliente_id: clienteId,
        p_limite: 20, p_apos_id: pageParam?.id ?? null, p_apos_score: pageParam?.score ?? null }).abortSignal(signal);
      if (error) throw error;
      return validarPaginaRanking(z.array(itemSchema).max(20).parse(data).map(item => ({ ...item, assinatura: null })), pageParam, null, false);
    }, getNextPageParam: (pagina) => { const ultimo = pagina.at(-1); return pagina.length === 20 && ultimo ? { id: ultimo.id, score: ultimo.score, assinatura: ultimo.assinatura } : undefined; } });
  return <section><h3>Composições de Backlog</h3><p>Ordenadas por GUTD quando os fatores estão informados. O ranking legado não está integrado.</p>
    {rankingConsistente && <p>Sem todos os fatores ou pesos válidos, a prioridade não é calculada. Mudanças durante paginação exigem reiniciar a consulta.</p>}
    {divididaId && <section aria-label="Composição recém-dividida"><h4>Composição separada</h4><p>Avalie GUTD antes de priorizar. A promoção é uma ação separada e não ocorreu automaticamente.</p><button type="button" onClick={() => setDivididaId(null)}>Voltar à lista</button>{dividida.isPending && <output>Carregando composição…</output>}{dividida.isError && <p role="alert">Não foi possível carregar a composição. <button type="button" onClick={() => void dividida.refetch()}>Tentar novamente</button></p>}{dividida.data && <Prioridade item={dividida.data} userId={userId} clienteId={clienteId} onDividida={setDivididaId} />}</section>}
    {filtroHabilitado && <form onSubmit={(e) => { e.preventDefault(); const id = alvoId.trim(); if (!z.string().uuid().safeParse(id).success) { setErroFiltro("Informe o ID válido do alvo."); return; } setErroFiltro(""); setFiltro({ tipo: alvoTipo, id }); }}><label>Tipo de alvo <select value={alvoTipo} onChange={(e) => setAlvoTipo(e.target.value)}><option value="sistema">Sistema</option><option value="componente">Componente</option><option value="grupo">Grupo Quantitativo</option></select></label><label>ID do alvo <input value={alvoId} onChange={(e) => setAlvoId(e.target.value)} /></label><button type="submit">Filtrar no servidor</button>{filtro && <button type="button" onClick={() => { setFiltro(null); setErroFiltro(""); }}>Limpar filtro</button>}{erroFiltro && <p role="alert">{erroFiltro}</p>}{filtro && <p>Filtro aplicado: {filtro.tipo} · {filtro.id}. Apenas composições desta fonte e deste Cliente são exibidas.</p>}</form>}
    <DiagnosticoComposicoesVazias userId={userId} clienteId={clienteId} />
    {lista.isFetching && <output>Carregando composições…</output>}
    {lista.isError && <p role="alert">Não foi possível consultar composições; dados podem ter mudado. <button type="button" onClick={() => void client.resetQueries({ queryKey: ["backlog-composicoes", userId, clienteId, rankingConsistente, filtro], exact: true })}>Reiniciar consulta</button></p>}
    {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma composição nesta fonte.</p>}
    {lista.data && <div hidden={lista.isFetching || lista.isError}>
      {lista.data.pages.flat().filter((item) => item.id !== divididaId).map((item) => <Prioridade key={item.id} item={item} userId={userId} clienteId={clienteId} onDividida={setDivididaId} />)}
    </div>}
    {!lista.isError && lista.hasNextPage && <button type="button" disabled={lista.isFetchingNextPage} onClick={() => void lista.fetchNextPage()}>Carregar mais composições</button>}
  </section>;
}

function Prioridade({ item, userId, clienteId, onDividida }: { item: Item; userId: string; clienteId: string; onDividida: (id: string) => void }) {
  const chave = `sso-backlog-prioridade:${JSON.stringify([userId, clienteId, item.id])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const texto = sessionStorage.getItem(chave); if (!texto) return null;
    const p = pedidoSchema.parse(JSON.parse(texto)); return p.id === item.id ? p : "invalido";
  } catch { return "invalido"; } });
  const [g, setG] = useState(item.gravidade?.toString() ?? ""); const [u, setU] = useState(item.urgencia?.toString() ?? "");
  const [t, setT] = useState(item.tendencia?.toString() ?? ""); const [d, setD] = useState(item.dor_cliente?.toString() ?? "");
  const [revisaoEditada, setRevisaoEditada] = useState(item.revisao);
  const revisaoMudou = item.revisao !== revisaoEditada;
  const [motivo, setMotivo] = useState(""); const [aviso, setAviso] = useState(""); const enviando = useRef(false); const client = useQueryClient();
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = await supabase.schema("pcm").rpc("sso_priorizar_composicao", { p_request_id: p.requestId, p_id: p.id,
      p_revisao: p.revisao, p_g: p.g, p_u: p.u, p_t: p.t, p_d: p.d, p_motivo: p.motivo });
    if (error) throw error;
    const r = z.object({ aggregateId: z.string().uuid(), revision: z.number().int(), requestId: z.string().uuid() }).strict().parse(data);
    if (r.aggregateId !== p.id || r.requestId !== p.requestId || r.revision !== p.revisao + 1) throw new Error("Resposta divergente");
  }, onSuccess: async (_r, p) => {
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Prioridade registrada, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setMotivo(""); setRevisaoEditada(p.revisao + 1); setAviso("Prioridade registrada.");
    await client.invalidateQueries({ queryKey: ["backlog-composicoes", userId, clienteId] });
    await client.invalidateQueries({ queryKey: ["backlog-composicao-direta", userId, clienteId, item.id] });
  }, onError: () => setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) {
    if (enviando.current) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); }
    catch { setAviso("Tentativa local indisponível ou alterada. Consulte suporte antes de repetir."); return; }
    enviando.current = true; envio.mutate(p);
  }
  function iniciar() { if (pendente || enviando.current || revisaoMudou) return; try {
    const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), id: item.id, revisao: revisaoEditada, g: Number(g), u: Number(u), t: Number(t), d: d ? Number(d) : null, motivo: motivo.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
    sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira fatores, motivo e sessão. Nada foi enviado."); } }
  return <article><p>{item.alvo_tipo} · {item.alvo_id} · {item.total} pendência(s) · {item.score === null ? "Prioridade não calculada" : `GUTD ${item.score.toFixed(2)}`}</p>
    <EscopoEvidencias userId={userId} clienteId={clienteId} composicaoId={item.id}/>
    <HistoricoSelecao userId={userId} clienteId={clienteId} composicaoId={item.id}/>
    {import.meta.env.VITE_SSO_DIVIDIR_BACKLOG_ENABLED === "true" && <DividirComposicao key={JSON.stringify([userId, clienteId, item.id])} userId={userId} clienteId={clienteId} composicaoId={item.id} revisao={item.revisao} total={item.total} onDividida={onDividida} />}
    {import.meta.env.VITE_SSO_PROMOVER_BACKLOG_CHAMADO_ENABLED === "true" && <PromoverComposicao key={JSON.stringify([userId, clienteId, item.id])} userId={userId} clienteId={clienteId} composicaoId={item.id} revisao={item.revisao} total={item.total} />}
    <VinculoChamado userId={userId} clienteId={clienteId} composicaoId={item.id}/>
    {revisaoMudou && !pendente && <div role="alert"><p>A composição mudou enquanto esta edição estava aberta. Os valores digitados foram preservados; recarregar substituirá os campos pelos dados atuais.</p><button type="button" onClick={() => {
      setG(item.gravidade?.toString() ?? ""); setU(item.urgencia?.toString() ?? "");
      setT(item.tendencia?.toString() ?? ""); setD(item.dor_cliente?.toString() ?? "");
      setMotivo(""); setRevisaoEditada(item.revisao); setAviso("");
    }}>Recarregar prioridade atual</button></div>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir prioridade</button> : !pendente &&
      <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Gravidade <input required type="number" min="1" max="5" step="1" value={g} onChange={(e) => setG(e.target.value)} /></label>
        <label>Urgência <input required type="number" min="1" max="5" step="1" value={u} onChange={(e) => setU(e.target.value)} /></label>
        <label>Tendência <input required type="number" min="1" max="5" step="1" value={t} onChange={(e) => setT(e.target.value)} /></label>
        <label>Dor do Cliente (opcional) <input type="number" min="1" max="5" step="1" value={d} onChange={(e) => setD(e.target.value)} /></label>
        <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <button type="submit" disabled={envio.isPending || revisaoMudou}>Salvar prioridade</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </article>;
}
