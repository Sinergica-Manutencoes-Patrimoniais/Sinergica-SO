import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const linha = z.object({ request_id: uuid, fonte_id: uuid, despesa_id: uuid, vinculo_id: uuid,
  despesa_revisao: z.number().int().positive(), rateio_revisao: z.number().int().positive(),
  criado_em: z.string().datetime({ offset: true }), decisao_revisao: z.number().int().nonnegative(),
  estado: z.enum(["ativa", "revogada"]) }).strict();
const pedidoSchema = z.object({ atorId: uuid, clienteId: uuid, listaId: uuid, requestId: uuid, correlacaoId: uuid,
  revision: z.number().int().nonnegative(), acao: z.enum(["revogar", "reativar"]), motivo: z.string().trim().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const reciboSchema = z.object({ requestId: uuid, clienteId: uuid, correlacaoId: uuid, revision: z.number().int().positive(),
  estado: z.enum(["ativa", "revogada"]), efeitoFinanceiro: z.literal(false) }).strict();

function validarRecibo(data: unknown, p: Pedido) {
  const r = reciboSchema.parse(data);
  if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.correlacaoId !== p.correlacaoId ||
    r.revision !== p.revision + 1 || r.estado !== (p.acao === "revogar" ? "revogada" : "ativa")) throw new Error("Recibo divergente");
}

export function DecidirCorrelacaoGasto({ usuario, cliente, listaId, disponivel }: {
  usuario: string; cliente: string; listaId: string; disponivel: boolean;
}) {
  const chave = `sso-decisao-correlacao:${JSON.stringify([usuario, cliente, listaId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === usuario && p.clienteId === cliente && p.listaId === listaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [selecionado, setSelecionado] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(""); const trava = useRef(false); const cache = useQueryClient();
  const raiz = ["orcamento-decisoes-correlacao", usuario, cliente, listaId] as const;
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== usuario) throw new Error("Sessão alterada"); }
  const consulta = useInfiniteQuery({ queryKey: raiz, initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      await conferirAtor(); const { data, error } = await supabase.schema("comercial").rpc(import.meta.env.VITE_SSO_CORRELACAO_GASTO_MEDIADA_ENABLED === "true" ? "sso_listar_correlacoes_gasto_v2_mediado" : "sso_listar_correlacoes_gasto_v2", {
        p_ator_id: usuario, p_cliente_id: cliente, p_lista_id: listaId, p_apos: pageParam, p_limite: 30,
      }).abortSignal(signal); if (error) throw error;
      const pagina = z.array(linha).max(30).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.request_id <= anterior) throw new Error("Página divergente"); anterior = item.request_id; }
      await conferirAtor(); if (signal.aborted) throw new Error("Consulta cancelada"); return pagina;
    }, getNextPageParam: (p) => p.length === 30 ? p.at(-1)?.request_id : undefined });
  const itens = !consulta.isFetching && !consulta.isError ? (consulta.data?.pages.flat() ?? []) : [];
  const paginasDivergentes = itens.some((linha, indice) => indice > 0 && linha.request_id.toLowerCase() <= itens[indice - 1]!.request_id.toLowerCase());
  const item = itens.find((i) => i.request_id === selecionado);
  const acao = item?.estado === "ativa" ? "revogar" : "reativar";
  const fotografia = JSON.stringify({ usuario, cliente, listaId, item, acao, motivo: motivo.trim() });
  async function consultarRecibo(p: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("comercial").rpc("sso_recibo_decisao_correlacao", {
        p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_lista_id: p.listaId, p_request_id: p.requestId,
        p_correlacao_id: p.correlacaoId, p_expected_revision: p.revision, p_acao: p.acao, p_motivo: p.motivo,
      });
      if (error) throw error;
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      if (data === null) { setAviso("Recibo ausente. Isso não comprova falha; preserve a tentativa."); return; }
      validarRecibo(data, p);
      await Promise.all([cache.invalidateQueries({ queryKey: raiz }),
        cache.invalidateQueries({ queryKey: ["orcamento-correlacoes-gasto", usuario, cliente, listaId] })]);
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setSelecionado(""); setMotivo(""); setConfirmacao(null);
      setAviso("Decisão anterior confirmada. Orçamentos anteriores permanecem inalterados.");
    } catch { setAviso("Não foi possível consultar o recibo. Preserve a tentativa ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function enviar(p: Pedido) {
    if (trava.current || !disponivel) return; trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("comercial").rpc(import.meta.env.VITE_SSO_CORRELACAO_GASTO_MEDIADA_ENABLED === "true" ? "sso_decidir_correlacao_gasto_mediado" : "sso_decidir_correlacao_gasto", {
        p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_correlacao_id: p.correlacaoId,
        p_expected_revision: p.revision, p_acao: p.acao, p_motivo: p.motivo,
      }); if (error) throw error;
      validarRecibo(data, p);
      await conferirAtor(); await Promise.all([cache.invalidateQueries({ queryKey: raiz }),
        cache.invalidateQueries({ queryKey: ["orcamento-correlacoes-gasto", usuario, cliente, listaId] })]);
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setSelecionado(""); setMotivo(""); setConfirmacao(null);
      setAviso("Decisão registrada. Orçamentos anteriores não foram alterados e devem ser revisados quando necessário.");
    } catch { setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || !disponivel || !item || paginasDivergentes || confirmacao !== fotografia) return;
    try {
      const p = pedidoSchema.parse({ atorId: usuario, clienteId: cliente, listaId, requestId: crypto.randomUUID(),
        correlacaoId: item.request_id, revision: item.decisao_revisao, acao, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira correlação e motivo. Nada foi enviado."); }
  }
  return <section aria-label="Revisar correlação de gasto">
    <h5>Revisar correlação de gasto</h5>
    <p>A decisão preserva o histórico e não altera orçamentos já registrados. Revogar uma correlação não prova que os gastos sejam diferentes.</p>
    {consulta.isFetching && <p role="status">Consultando decisões…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {paginasDivergentes && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void consulta.refetch()}>Consultar novamente</button></p>}
    {consulta.hasNextPage && !consulta.isFetching && !consulta.isError && !paginasDivergentes && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais correlações</button>}
    {pendente === "invalido" ? <p role="alert">Tentativa inválida. Procure suporte.</p> : pendente ? <>
      <p>Há uma tentativa pendente; o resultado pode ser incerto.</p><button type="button" disabled={ocupado || !disponivel} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button>
      {import.meta.env.VITE_SSO_RECIBO_DECISAO_CORRELACAO_ENABLED === "true" && <button type="button" disabled={ocupado} onClick={() => void consultarRecibo(pendente)}>Consultar recibo</button>}
    </> : <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
      <label>Correlação <select value={selecionado} disabled={!disponivel || ocupado || consulta.isFetching || consulta.isError || paginasDivergentes} required
        onChange={(e) => { setSelecionado(e.target.value); setConfirmacao(null); }}><option value="">Selecione</option>
        {!paginasDivergentes && itens.map((i) => <option key={i.request_id} value={i.request_id}>{i.estado} · fonte {i.fonte_id} · despesa {i.despesa_id} · vínculo {i.vinculo_id}</option>)}
      </select></label>
      <label>Motivo <textarea required maxLength={1000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === fotografia && !paginasDivergentes} disabled={!disponivel || !item || !motivo.trim() || ocupado || paginasDivergentes}
        onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi a correlação e a decisão de {acao}.</label>
      <button type="submit" disabled={!disponivel || !item || !motivo.trim() || ocupado || paginasDivergentes || confirmacao !== fotografia}>{acao === "revogar" ? "Revogar" : "Reativar"} correlação</button>
    </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
