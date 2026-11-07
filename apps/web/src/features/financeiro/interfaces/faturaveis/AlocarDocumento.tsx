import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ParcelaAdicional } from "./ParcelaAdicional";

const esquema = z.object({ requestId: z.string().guid(), alocacaoId: z.string().guid(), itemId: z.string().guid(),
  expectedRevision: z.number().int().positive(), lancamentoId: z.string().guid(), documentoRef: z.string().trim().min(1).max(200),
  dataDocumento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), valorCentavos: z.number().int().positive().safe(), protocolo: z.literal("mediado").optional() }).strict();
type Pedido = z.infer<typeof esquema>;
type Props = { usuario: string; cliente: string; itemId: string; revisao: number };
export function AlocarDocumento(props: Props) {
  if (import.meta.env.VITE_SSO_ALOCAR_FATURAVEL_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.itemId])} {...props} />;
}
function Conteudo({ usuario, cliente, itemId, revisao }: Props) {
  const chave = `sso-alocar-faturavel:${usuario}:${cliente}:${itemId}`;
  const queryClient = useQueryClient();
  const enviando = useRef(false);
  const [lancamento, setLancamento] = useState("");
  const [documento, setDocumento] = useState("");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = esquema.parse(JSON.parse(salvo)); return p.itemId === itemId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const saldo = useQuery({ queryKey: ["faturavel-saldo", usuario, cliente, itemId, revisao], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");const { data: valorAtual, error } = await supabase.schema("financeiro").rpc("sso_consultar_saldo_faturavel", { p_cliente_id: cliente, p_item_id: itemId }).abortSignal(signal);
      if (error) throw error;
      const resultado = z.object({ itemId: z.string().guid(), revisao: z.number().int().positive(), situacao: z.enum(["nao_conferido", "divergente", "calculado"]), conferidoCentavos: z.string().nullable(), alocadoCentavos: z.string(), reservadoCentavos: z.string(), disponivelCentavos: z.string().nullable() }).strict().parse(valorAtual);
      if (resultado.itemId !== itemId || resultado.revisao !== revisao || resultado.situacao !== "calculado" || resultado.disponivelCentavos === null || !/^\d+$/.test(resultado.disponivelCentavos)) throw new Error("Saldo indisponível ou revisão divergente.");
      const disponivel=z.number().int().nonnegative().safe().parse(Number(resultado.disponivelCentavos));const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return disponivel; } });
  const previaParcela = useQuery({ queryKey: ["faturavel-previa-parcela-documento", usuario, cliente, itemId, lancamento, revisao], gcTime: 0, retry: false,
    enabled: import.meta.env.VITE_SSO_PREVIA_PARCELA_DOCUMENTO_ENABLED === "true" && z.string().guid().safeParse(lancamento).success,
    queryFn: async ({ signal }) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");const { data: resposta, error } = await supabase.schema("financeiro").rpc("sso_previa_parcela_documento", { p_cliente_id: cliente, p_item_id: itemId, p_lancamento_id: lancamento }).abortSignal(signal); if (error) throw error;
      const p = z.object({ itemId: z.string().guid(), lancamentoId: z.string().guid(), revisaoItem: z.number().int(), documento: z.object({ id: z.string().guid(), referencia: z.string(), data: z.string() }).strict().nullable(), alocadoItemCentavos: z.string(), alocadoDocumentoCentavos: z.string().nullable(), parcelasAdicionaisHabilitadas: z.boolean(), reservaSaldo: z.literal(false), cobrancaEnviada: z.literal(false) }).strict().parse(resposta);
      if (p.itemId !== itemId || p.lancamentoId !== lancamento || p.revisaoItem !== revisao) throw new Error("Prévia divergente");const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return p; } });
  const opcoes = useInfiniteQuery({ queryKey: ["faturavel-lancamentos", usuario, cliente, itemId], gcTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam,signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const { data: valores, error } = await supabase.schema("financeiro").rpc("sso_consultar_lancamentos_faturavel", { p_cliente_id: cliente, p_item_id: itemId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; const pagina=z.array(z.object({ id: z.string().guid(), descricao: z.string().nullable(),
        valor_centavos: z.number().int().positive().safe(), competencia: z.string(), vencimento: z.string().nullable() }).strict()).max(20).parse(valores);
      let anterior=pageParam?.toLowerCase()??"";for(const item of pagina){const atual=item.id.toLowerCase();if(atual<=anterior)throw new Error("Página divergente.");anterior=atual;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou pedido alterado.");
    const { data: resposta, error } = await supabase.schema("financeiro").rpc(p.protocolo === "mediado" ? "sso_alocar_documento_mediado" : "sso_alocar_faturavel_documento", {
      ...(p.protocolo === "mediado" ? { p_ator_id: usuario, p_cliente_id: cliente } : {}),
      p_request_id: p.requestId, p_alocacao_id: p.alocacaoId, p_item_id: p.itemId, p_expected_revision: p.expectedRevision,
      p_lancamento_id: p.lancamentoId, p_documento_ref: p.documentoRef, p_data_documento: p.dataDocumento, p_valor_centavos: p.valorCentavos });
    if (error) throw error;
    if (!resposta || resposta.requestId !== p.requestId || resposta.aggregateId !== p.itemId || resposta.revision !== p.expectedRevision + 1 ||
      resposta.linkedIds?.alocacaoId !== p.alocacaoId || resposta.linkedIds?.lancamentoId !== p.lancamentoId ||
      !["parcial", "faturado"].includes(resposta.state)) throw new Error("Resposta inválida.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario)throw new Error("Sessão alterada.");
  }, onSuccess: async (_resultado, p) => {
    try { await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["faturaveis", usuario, cliente] }),
      queryClient.invalidateQueries({ queryKey: ["faturavel-saldo", usuario, cliente, itemId] }),
      queryClient.invalidateQueries({ queryKey: ["faturavel-lancamentos", usuario, cliente, itemId] }),
      queryClient.invalidateQueries({ queryKey: ["faturavel-previa-parcela-documento", usuario, cliente, itemId] }),
    ]);
    const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==usuario||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou pedido alterado.");sessionStorage.removeItem(chave);setPendente(null);setConfirmado(null);setMensagem("Documento vinculado. Não foi criado lançamento ou cobrança."); }
    catch { setMensagem("Alocação registrada, mas a tentativa local divergiu ou está indisponível; procure suporte."); } },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa e consulte suporte."), onSettled: () => { enviando.current = false; }, });
  function registrar(p: Pedido) {
    if (enviando.current) return;
    try { const existente = sessionStorage.getItem(chave); const serializado = JSON.stringify(p);
      if ((existente !== null && existente !== serializado) || (existente === null && pendente !== null)) { setMensagem("Existe outra tentativa pendente ou o pedido local está ausente. Não crie nova alocação; procure suporte."); return; }
      sessionStorage.setItem(chave, serializado);
    } catch { setMensagem("Não foi possível guardar tentativa; operação não enviada."); return; }
    enviando.current = true; setPendente(p); setMensagem(""); enviar.mutate(p);
  }
  const lancamentos = opcoes.data?.pages.flat() ?? [];
  const paginasDivergentes = new Set(lancamentos.map((item) => item.id.toLowerCase())).size !== lancamentos.length;
  const lancamentoSelecionado = paginasDivergentes ? undefined : lancamentos.find((item) => item.id === lancamento);
  const fotografia=JSON.stringify({usuario,cliente,itemId,revisao,lancamento:lancamentoSelecionado ?? null,documento:documento.trim(),data,valor,saldo:saldo.data,
    previa: !previaParcela.isFetching && !previaParcela.isError ? previaParcela.data ?? null : null});
  return <section><h4>Alocar a documento existente</h4>
    <p>Não cria lançamento, cobrança nem recebível. Confirme o documento e a distribuição antes de vincular.</p>
    {saldo.isError || opcoes.isError ? <p role="alert">Não foi possível consultar saldo ou lançamentos autorizados.</p> : null}
    {!opcoes.isFetching && !opcoes.isError && paginasDivergentes && <p role="alert">Os lançamentos mudaram durante a consulta. <button type="button" onClick={() => void opcoes.refetch()}>Atualizar lançamentos</button></p>}
    {!saldo.isFetching && !saldo.isError && saldo.data !== undefined && <p>Saldo do item: {saldo.data} centavos.</p>}
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || enviar.isPending || enviando.current || confirmado!==fotografia || saldo.isFetching || saldo.isError || opcoes.isFetching || opcoes.isError || paginasDivergentes || !lancamentoSelecionado || saldo.data === undefined) return;
      try { const p = esquema.parse({ requestId: crypto.randomUUID(), alocacaoId: crypto.randomUUID(), itemId,
        expectedRevision: revisao, lancamentoId: lancamento, documentoRef: documento, dataDocumento: data,
        valorCentavos: /^\d+$/.test(valor) ? Number(valor) : NaN, ...(import.meta.env.VITE_SSO_ALOCACAO_DOCUMENTO_MEDIADA_ENABLED === "true" ? { protocolo: "mediado" as const } : {}) });
        if (p.valorCentavos > saldo.data || !opcoes.data?.pages.flat().some((opcao) => opcao.id === p.lancamentoId)) throw new Error("Saldo ou lançamento indisponível"); registrar(p);
      } catch { setMensagem("Confira lançamento, documento, data e saldo."); }
    }}><fieldset disabled={!!pendente || enviar.isPending || saldo.isFetching || opcoes.isFetching || saldo.isError || opcoes.isError || paginasDivergentes}>
      <label>Lançamento de entrada existente <select required value={lancamento} onChange={(e) => setLancamento(e.target.value)}>
        <option value="">Selecione</option>{!opcoes.isFetching && !opcoes.isError && !paginasDivergentes && lancamentos.map((l) => <option key={l.id} value={l.id}>{l.descricao || l.id} · {l.valor_centavos} centavos · {l.competencia}</option>)}</select></label>
      {!opcoes.isFetching && !opcoes.isError && opcoes.hasNextPage && <button type="button" onClick={() => void opcoes.fetchNextPage()}>Mais lançamentos</button>}
      {previaParcela.isFetching && <output>Consultando documento existente…</output>}
      {previaParcela.isError && <p role="alert">Prévia indisponível. A autorização e o saldo serão revalidados no servidor.</p>}
      {previaParcela.data && !previaParcela.isFetching && !previaParcela.isError && <p>{previaParcela.data.documento ? `Documento já vinculado: ${previaParcela.data.documento.referencia}, data ${previaParcela.data.documento.data}.` : "Nenhum documento vinculado a este lançamento."} Parcela adicional no mesmo documento: {previaParcela.data.parcelasAdicionaisHabilitadas ? "gate habilitado" : "gate fechado"}. Prévia não reserva saldo.</p>}
      <label>Referência do documento <input maxLength={200} value={documento} onChange={(e) => setDocumento(e.target.value)} /></label>
      <label>Data do documento <input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label>Valor a alocar, em centavos <input inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
      {confirmado && confirmado!==fotografia && <p role="alert">Dados ou saldo mudaram; confira novamente.</p>}
      <label><input type="checkbox" checked={confirmado===fotografia} onChange={(e) => setConfirmado(e.target.checked?fotografia:null)} /> Confirmei documento, valor e vínculo com este item.</label>
      <button type="submit" disabled={confirmado!==fotografia}>Vincular documento</button>
    </fieldset></form>
    {import.meta.env.VITE_SSO_PARCELA_ADICIONAL_ENABLED === "true" && previaParcela.data?.documento && previaParcela.data.parcelasAdicionaisHabilitadas && !previaParcela.isFetching && !previaParcela.isError && saldo.data !== undefined && !saldo.isFetching && !saldo.isError && <ParcelaAdicional key={previaParcela.data.documento.id} usuario={usuario} cliente={cliente} itemId={itemId} documentoId={previaParcela.data.documento.id} revisao={previaParcela.data.revisaoItem} saldo={saldo.data} />}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
