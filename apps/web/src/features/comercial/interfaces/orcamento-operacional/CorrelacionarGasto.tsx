import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { DecidirCorrelacaoGasto } from "./DecidirCorrelacaoGasto";

const uuid = z.string().uuid();
const pedidoSchema = z.object({ atorId: uuid, clienteId: uuid, listaId: uuid, requestId: uuid, fonteId: uuid, despesaId: uuid, vinculoId: uuid,
  despesaRevision: z.number().int().positive(), rateioRevision: z.number().int().positive(), motivo: z.string().trim().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const reciboSchema = z.object({ requestId: uuid, clienteId: uuid, fonteId: uuid, despesaId: uuid, vinculoId: uuid,
  correlacaoDeclarada: z.literal(true), efeitoFinanceiro: z.literal(false) }).strict();
function validarRecibo(data: unknown, p: Pedido) {
  const r = reciboSchema.parse(data);
  if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.fonteId !== p.fonteId ||
    r.despesaId !== p.despesaId || r.vinculoId !== p.vinculoId) throw new Error("Recibo divergente");
}
const linha = z.object({ request_id: uuid, fonte_id: uuid, despesa_id: uuid, vinculo_id: uuid,
  despesa_revisao: z.number().int().positive(), rateio_revisao: z.number().int().positive(), criado_em: z.string().datetime({ offset: true }),
  decisao_revisao: z.number().int().nonnegative().optional(), estado: z.enum(["ativa", "revogada"]).optional() }).strict();
export function CorrelacionarGasto({ usuario, cliente, listaId, fonte, parcela, disponivel, aoDetectarConflito }: {
  usuario: string; cliente: string; listaId: string; fonte: { id: string; descricao: string; valor_centavos: number } | null;
  parcela: { despesa_id: string; vinculo_id: string; despesa_revision: number; rateio_revision: number; descricao: string; valor_centavos: number } | null;
  disponivel: boolean;
  aoDetectarConflito?: (chaves: string[] | null) => void;
}) {
  const chave = `sso-correlacao-gasto:${JSON.stringify([usuario, cliente, listaId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === usuario && p.clienteId === cliente && p.listaId === listaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState(""); const trava = useRef(false);
  const cache = useQueryClient(); const raiz = ["orcamento-correlacoes-gasto", usuario, cliente, listaId] as const;
  const fotografia = JSON.stringify({ usuario, cliente, listaId, fonte, parcela, motivo: motivo.trim() });
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== usuario) throw new Error("Sessão alterada"); }
  const consulta = useInfiniteQuery({ queryKey: raiz, initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      await conferirAtor(); const mediado = import.meta.env.VITE_SSO_CORRELACAO_GASTO_MEDIADA_ENABLED === "true"; const { data, error } = await supabase.schema("comercial").rpc(import.meta.env.VITE_SSO_DECISAO_CORRELACAO_ENABLED === "true" ? (mediado ? "sso_listar_correlacoes_gasto_v2_mediado" : "sso_listar_correlacoes_gasto_v2") : (mediado ? "sso_listar_correlacoes_gasto_mediado" : "sso_listar_correlacoes_gasto"), {
        p_ator_id: usuario, p_cliente_id: cliente, p_lista_id: listaId, p_apos: pageParam, p_limite: 30,
      }).abortSignal(signal); if (error) throw error;
      const pagina = z.array(linha).max(30).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.request_id <= anterior) throw new Error("Página divergente"); anterior = item.request_id; }
      await conferirAtor(); if (signal.aborted) throw new Error("Consulta cancelada"); return pagina;
    }, getNextPageParam: (p) => p.length === 30 ? p.at(-1)?.request_id : undefined });
  const itens = !consulta.isFetching && !consulta.isError ? (consulta.data?.pages.flat() ?? []) : [];
  const paginasDivergentes = itens.some((item, indice) => indice > 0 && item.request_id.toLowerCase() <= itens[indice - 1]!.request_id.toLowerCase());
  const existente = fonte && parcela ? itens.find((i) => i.fonte_id.toLowerCase() === fonte.id.toLowerCase() &&
    i.despesa_id.toLowerCase() === parcela.despesa_id.toLowerCase() && i.vinculo_id.toLowerCase() === parcela.vinculo_id.toLowerCase()) : undefined;
  const conhecida = !!existente;
  // Propagar todas as correlações carregadas para a composição, não apenas
  // o par atualmente selecionado para declarar uma nova relação.
  const conflitos = JSON.stringify(itens.filter((i)=>i.estado!=="revogada")
    .map((i)=>JSON.stringify([i.fonte_id.toLowerCase(),i.despesa_id.toLowerCase(),i.vinculo_id.toLowerCase()])).sort());
  // Uma página parcial não permite concluir que as fontes selecionadas não
  // aparecem nas páginas ainda não carregadas.
  const consultaPronta = !!consulta.data && !consulta.isFetching && !consulta.isError && !consulta.hasNextPage && !paginasDivergentes;
  useEffect(() => { aoDetectarConflito?.(consultaPronta ? JSON.parse(conflitos) as string[] : null); }, [aoDetectarConflito, conflitos, consultaPronta]);
  async function consultarRecibo(p: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("comercial").rpc("sso_recibo_correlacao_gasto", {
        p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_lista_id: p.listaId, p_request_id: p.requestId,
        p_fonte_id: p.fonteId, p_despesa_id: p.despesaId, p_vinculo_id: p.vinculoId,
        p_despesa_revision: p.despesaRevision, p_rateio_revision: p.rateioRevision, p_motivo: p.motivo,
      });
      if (error) throw error;
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      if (data === null) { setAviso("Recibo ausente. Isso não comprova falha; preserve a tentativa."); return; }
      validarRecibo(data, p); await cache.invalidateQueries({ queryKey: raiz }); await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setMotivo(""); setConfirmacao(null);
      setAviso("Correlação anterior confirmada. Nenhum valor foi movimentado.");
    } catch { setAviso("Não foi possível consultar o recibo. Preserve a tentativa ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("comercial").rpc(import.meta.env.VITE_SSO_CORRELACAO_GASTO_MEDIADA_ENABLED === "true" ? "sso_declarar_correlacao_gasto_mediado" : "sso_declarar_correlacao_gasto", {
        p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_fonte_id: p.fonteId,
        p_despesa_id: p.despesaId, p_vinculo_id: p.vinculoId, p_despesa_revision: p.despesaRevision, p_rateio_revision: p.rateioRevision, p_motivo: p.motivo,
      }); if (error) throw error;
      validarRecibo(data, p);
      await conferirAtor(); await cache.invalidateQueries({ queryKey: raiz }); await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setMotivo(""); setConfirmacao(null); setAviso("Correlação registrada. Nenhum valor foi movimentado.");
    } catch { setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || !disponivel || !fonte || !parcela || conhecida || !consultaPronta || confirmacao !== fotografia) return;
    try {
      const p = pedidoSchema.parse({ atorId: usuario, clienteId: cliente, listaId, requestId: crypto.randomUUID(), fonteId: fonte.id,
        despesaId: parcela.despesa_id, vinculoId: parcela.vinculo_id, despesaRevision: parcela.despesa_revision, rateioRevision: parcela.rateio_revision, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira as fontes e o motivo. Nada foi enviado."); }
  }
  return <section aria-label="Correlação declarada de gasto">
    <h4>Mesmo gasto em duas fontes</h4>
    {import.meta.env.VITE_SSO_DECISAO_CORRELACAO_ENABLED === "true" && <DecidirCorrelacaoGasto key={JSON.stringify([usuario, cliente, listaId])}
      usuario={usuario} cliente={cliente} listaId={listaId} disponivel={disponivel} />}
    <p>Selecione uma aquisição e uma parcela acima para declarar que representam o mesmo gasto. A ausência nas páginas carregadas não comprova inexistência de correlação.</p>
    {consulta.isFetching && <p role="status">Consultando correlações…</p>}
    {consulta.isError && <p role="alert">Correlações indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {paginasDivergentes && <p role="alert">Páginas de correlações divergentes. <button type="button" onClick={() => void consulta.refetch()}>Consultar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && !paginasDivergentes && consulta.data && <><p>{itens.length} correlação(ões) carregada(s).</p>
      {conhecida && <p role="alert">{existente.estado === "revogada" ? "Esta correlação está revogada. Use a revisão para reativá-la se necessário." : "Esta correlação está ativa. Não selecione ambas na composição."}</p>}
      {consulta.hasNextPage && <><p>Há outras páginas. Carregue todas as correlações antes de confirmar a composição; isso não substitui a verificação do servidor.</p><button type="button" onClick={() => void consulta.fetchNextPage()}>Mais correlações</button></>}</>}
    {pendente === "invalido" ? <p role="alert">Tentativa inválida. Procure suporte.</p> : pendente ? <>
      <p>Há uma tentativa pendente; o resultado pode ser incerto.</p><button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button>
      {import.meta.env.VITE_SSO_RECIBO_CORRELACAO_GASTO_ENABLED === "true" && <button type="button" disabled={ocupado} onClick={() => void consultarRecibo(pendente)}>Consultar recibo</button>}
    </> : <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
      {fonte && parcela && <p>Aquisição: {fonte.descricao} · {fonte.valor_centavos} centavos. Parcela: {parcela.descricao} · {parcela.valor_centavos} centavos.</p>}
      <label>Motivo <textarea required maxLength={1000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === fotografia && consultaPronta} disabled={!disponivel || !fonte || !parcela || conhecida || !consultaPronta || ocupado || !motivo.trim()} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Declaro que estas duas fontes representam o mesmo gasto.</label>
      <button type="submit" disabled={!disponivel || !fonte || !parcela || conhecida || !consultaPronta || ocupado || !motivo.trim() || confirmacao !== fotografia}>Registrar correlação</button>
    </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
