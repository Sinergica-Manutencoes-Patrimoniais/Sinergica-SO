import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { listarParcelasOrcamento, prepararMistoSchema, prepararOrcamentoMisto, type PrepararOrcamentoMisto } from "../../infrastructure/supabase-orcamento-operacional-adapter";
import { HistoricoComposicaoMista } from "./HistoricoComposicaoMista";
import { CorrelacionarGasto } from "./CorrelacionarGasto";
import { centavosParaEntradaReais, valorReaisParaCentavos } from "../../domain/valor-em-reais";

const uuid = z.string().uuid();
const aquisicaoSchema = z.object({ id: uuid, lista_revisao: z.number().int().positive(), tipo: z.enum(["material", "retirada_exclusiva"]),
  descricao: z.string().min(1).max(1000), valor_centavos: z.number().int().safe().nonnegative().max(1_000_000_000_000),
  criado_em: z.string().datetime({ offset: true }) }).strict();
type Aquisicao = z.infer<typeof aquisicaoSchema>;
type Parcela = Awaited<ReturnType<typeof listarParcelasOrcamento>>[number];
type Props = { usuario: string; cliente: string; propostaId: string; propostaRevisao: number; listaId: string; listaRevisao: number; permitirEdicao: boolean; aoSalvar: () => void };
const chaveParcela = (p: Pick<Parcela, "despesa_id" | "vinculo_id">) => JSON.stringify([p.despesa_id.toLowerCase(), p.vinculo_id.toLowerCase()]);
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (centavos: number | bigint) =>
  (typeof centavos === "bigint" && centavos > BigInt(Number.MAX_SAFE_INTEGER)) ||
  (typeof centavos === "number" && !Number.isSafeInteger(centavos))
    ? "valor acima do limite de apresentação"
    : moeda.format(Number(centavos) / 100);

export function PrepararMisto({ usuario, cliente, propostaId, propostaRevisao, listaId, listaRevisao, permitirEdicao, aoSalvar }: Props) {
  const chave = `sso-composicao-mista:${JSON.stringify([usuario, cliente, propostaId])}`;
  const [pendente, setPendente] = useState<PrepararOrcamentoMisto | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = prepararMistoSchema.parse(JSON.parse(salvo));
      return p.atorId === usuario && p.clienteId === cliente && p.propostaId === propostaId && p.listaId === listaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [aquisicoes, setAquisicoes] = useState<Aquisicao[]>([]); const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [descricao, setDescricao] = useState(""); const [fator, setFator] = useState("1.5"); const [preco, setPreco] = useState("");
  const [basePrecoSugerido, setBasePrecoSugerido] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  const [correlacoesCarregadas, setCorrelacoesCarregadas] = useState<string[] | null>(null);
  const registrarConflitos = useCallback((chaves: string[] | null) => { setCorrelacoesCarregadas(chaves); }, []);
  const trava = useRef(false); const cache = useQueryClient();
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== usuario) throw new Error("Sessão alterada"); }
  const qa = useInfiniteQuery({ queryKey: ["orcamento-fontes-aquisicao", usuario, cliente, listaId], initialPageParam: null as string | null,
    gcTime: 0, enabled: permitirEdicao, retry: false,
    queryFn: async ({ pageParam, signal }) => { await conferirAtor(); const { data, error } = await supabase.schema("comercial").rpc("sso_listar_fontes_aquisicao", {
      p_ator_id: usuario, p_cliente_id: cliente, p_lista_id: listaId, p_apos: pageParam, p_limite: 50,
    }).abortSignal(signal); if (error) throw error;
      const pagina = z.array(aquisicaoSchema).max(50).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.id <= anterior) throw new Error("Página divergente"); anterior = item.id; }
      await conferirAtor(); if (signal.aborted) throw new Error("Consulta cancelada"); return pagina;
    }, getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.id : undefined });
  const qp = useInfiniteQuery({ queryKey: ["orcamento-parcelas", usuario, cliente, listaId], initialPageParam: null as { despesaId: string; vinculoId: string } | null,
    gcTime: 0, enabled: permitirEdicao, retry: false,
    queryFn: ({ pageParam, signal }) => listarParcelasOrcamento(usuario, cliente, listaId, pageParam, signal),
    getNextPageParam: (p) => p.length === 30 ? { despesaId: p[p.length - 1]!.despesa_id, vinculoId: p[p.length - 1]!.vinculo_id } : undefined });
  const itensA = qa.data?.pages.flat() ?? []; const itensP = qp.data?.pages.flat() ?? [];
  const aquisicoesDuplicadas = new Set(itensA.map((a) => a.id.toLowerCase())).size !== itensA.length;
  const parcelasDuplicadas = new Set(itensP.map(chaveParcela)).size !== itensP.length;
  const paginasDivergentes = aquisicoesDuplicadas || parcelasDuplicadas;
  const pronta = !!qa.data && !!qp.data && !qa.isFetching && !qp.isFetching && !qa.isError && !qp.isError && !paginasDivergentes;
  const atual = aquisicoes.every((a) => a.lista_revisao === listaRevisao && itensA.some((x) => JSON.stringify(x) === JSON.stringify(a))) &&
    parcelas.every((p) => itensP.some((x) => JSON.stringify(x) === JSON.stringify(p)));
  const totalA = aquisicoes.reduce((n, a) => n + BigInt(a.valor_centavos), 0n);
  const totalP = parcelas.reduce((n, p) => n + BigInt(p.valor_centavos), 0n);
  const limites = aquisicoes.length <= 100 && parcelas.length <= 100 && totalA <= 1_000_000_000_000n && totalP <= 1_000_000_000_000n;
  const baseSugestao = JSON.stringify([aquisicoes, parcelas, fator]);
  const sugestao = (() => {
    if (!limites || aquisicoes.length + parcelas.length === 0 || !/^\d{1,3}(?:\.\d{1,4})?$/.test(fator)) return null;
    const [inteiro = "0", fracao = ""] = fator.split(".");
    const multiplicador = BigInt(inteiro) * 10_000n + BigInt(fracao.padEnd(4, "0"));
    if (multiplicador < 10_000n || multiplicador > 1_000_000n) return null;
    const resultado = (totalA * multiplicador + 5_000n) / 10_000n + totalP;
    return resultado <= 1_000_000_000_000n ? resultado.toString() : null;
  })();
  const sugestaoDesatualizada = basePrecoSugerido !== null && basePrecoSugerido !== baseSugestao;
  const precoCentavos = valorReaisParaCentavos(preco);
  const correlacoesProntas = import.meta.env.VITE_SSO_CORRELACAO_GASTO_ENABLED !== "true" || correlacoesCarregadas !== null;
  const conflitoAtual = aquisicoes.some((a) => parcelas.some((p) =>
    correlacoesCarregadas?.includes(JSON.stringify([a.id.toLowerCase(),p.despesa_id.toLowerCase(),p.vinculo_id.toLowerCase()]))));
  const fotografia = JSON.stringify({ usuario, cliente, propostaId, propostaRevisao, listaId, listaRevisao, aquisicoes, parcelas, descricao, fator, preco });
  async function enviar(p: PrepararOrcamentoMisto) {
    if (trava.current || !permitirEdicao) return; trava.current = true; setOcupado(true); setAviso("");
    const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      await prepararOrcamentoMisto(p); await conferirAtor();
      await Promise.all([cache.invalidateQueries({ queryKey: ["orcamento-fontes-aquisicao", usuario, cliente, listaId] }),
        cache.invalidateQueries({ queryKey: ["orcamento-parcelas", usuario, cliente, listaId] })]);
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setAquisicoes([]); setParcelas([]); setConfirmacao(null);
      try { aoSalvar(); setAviso("Composição registrada; nenhuma proposta enviada ou cobrança criada."); }
      catch { setAviso("Composição registrada; atualize a tela antes de continuar."); }
    } catch { setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || !permitirEdicao || !pronta || !atual || !limites || !correlacoesProntas || sugestaoDesatualizada || conflitoAtual || confirmacao !== fotografia ||
      aquisicoes.length + parcelas.length === 0 || !/^\d{1,3}(?:\.\d{1,4})?$/.test(fator) || precoCentavos === null) return;
    try {
      const p = prepararMistoSchema.parse({ atorId: usuario, clienteId: cliente, requestId: crypto.randomUUID(), propostaId,
        expectedRevision: propostaRevisao, listaId, listaRevision: listaRevisao, descricao, fator: Number(fator), precoCentavos,
        aquisicaoIds: aquisicoes.map((a) => a.id).sort(), fontes: parcelas.map((x) => ({ despesaId: x.despesa_id, despesaRevision: x.despesa_revision,
          rateioRevision: x.rateio_revision, vinculoId: x.vinculo_id, valorCentavos: x.valor_centavos, base: x.base, descricaoFonte: x.descricao, grupo: "operacional" })) });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira as fontes, a descrição, o fator e o preço. Nada foi enviado."); }
  }
  return <section aria-label="Composição mista de orçamento">
    <h3>Composição de aquisição e despesas operacionais</h3>
    {import.meta.env.VITE_SSO_HISTORICO_COMPOSICAO_MISTA_ENABLED === "true" && <HistoricoComposicaoMista usuario={usuario} cliente={cliente} propostaId={propostaId} versao={propostaRevisao} />}
    {import.meta.env.VITE_SSO_CORRELACAO_GASTO_ENABLED === "true" && <CorrelacionarGasto usuario={usuario} cliente={cliente} listaId={listaId}
      fonte={aquisicoes.length === 1 ? aquisicoes[0]! : null} parcela={parcelas.length === 1 ? parcelas[0]! : null}
      disponivel={permitirEdicao && pronta && atual && !ocupado && !pendente} aoDetectarConflito={registrarConflitos} />}
    <p>Confirme as fontes e possíveis duplicidades físicas. A seleção não prova que registros distintos sejam gastos diferentes.</p>
    {pendente === "invalido" ? <p role="alert">Tentativa inválida. Procure suporte.</p> : pendente ? <>
      <p>Há uma tentativa pendente; resultado pode ser incerto.</p><button type="button" disabled={ocupado || !permitirEdicao} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button>
    </> : <>
      {(qa.isFetching || qp.isFetching) && <p role="status">Consultando fontes…</p>}
      {(qa.isError || qp.isError) && <p role="alert">Fontes indisponíveis. <button type="button" onClick={() => { void qa.refetch(); void qp.refetch(); }}>Tentar novamente</button></p>}
      {paginasDivergentes && <p role="alert">A consulta apresentou fontes repetidas entre páginas. Atualize antes de compor. <button type="button" disabled={ocupado} onClick={() => { setConfirmacao(null); void qa.refetch(); void qp.refetch(); }}>Atualizar fontes</button></p>}
      {pronta && <><fieldset disabled={ocupado || !permitirEdicao}><legend>Fontes de aquisição</legend>
        {itensA.map((a) => <label key={a.id}><input type="checkbox" checked={aquisicoes.some((x) => x.id === a.id)} disabled={a.lista_revisao !== listaRevisao} onChange={(e) => {
          const marcado = e.target.checked; setAquisicoes((x) => marcado ? [...x, a] : x.filter((v) => v.id !== a.id)); setConfirmacao(null);
        }} /> {a.tipo === "material" ? "Material" : "Retirada exclusiva"} · {a.descricao} · {reais(a.valor_centavos)} {a.lista_revisao !== listaRevisao && "· revisão da lista diferente"}</label>)}</fieldset>
        {qa.hasNextPage && <button type="button" onClick={() => void qa.fetchNextPage()}>Mais fontes de aquisição</button>}
        <fieldset disabled={ocupado || !permitirEdicao}><legend>Parcelas operacionais da Visita</legend>
          {itensP.map((p) => { const id = chaveParcela(p); return <label key={id}><input type="checkbox" checked={parcelas.some((x) => chaveParcela(x) === id)} onChange={(e) => {
            const marcado = e.target.checked; setParcelas((x) => marcado ? [...x, p] : x.filter((v) => chaveParcela(v) !== id)); setConfirmacao(null);
          }} /> {p.descricao} · {reais(p.valor_centavos)} · {p.base}</label>; })}</fieldset>
        {qp.hasNextPage && <button type="button" onClick={() => void qp.fetchNextPage()}>Mais parcelas</button>}
      </>}
      {!atual && <p role="alert">Alguma fonte mudou ou não está carregada. Refaça a seleção.</p>}
      {!limites && <p role="alert">Quantidade ou valor excedeu o limite.</p>}
      {!correlacoesProntas && <p role="alert">Conclua ou recupere todas as páginas de correlações antes de salvar.</p>}
      {conflitoAtual && <p role="alert">Há fontes selecionadas com correlação ativa carregada. Retire uma delas antes de salvar; correlações não carregadas exigem verificação no servidor.</p>}
      <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <p>Aquisição: {reais(totalA)} · operacional: {reais(totalP)}.</p>
        <label>Descrição <textarea required maxLength={4000} value={descricao} onChange={(e) => { setDescricao(e.target.value); setConfirmacao(null); }} /></label>
        <label>Fator <input type="number" min="1" max="100" step="0.0001" required value={fator} onChange={(e) => { setFator(e.target.value); setConfirmacao(null); }} /></label>
        <label>Preço em reais <input type="text" inputMode="decimal" maxLength={24} required value={preco} onChange={(e) => { setPreco(e.target.value); setBasePrecoSugerido(null); setConfirmacao(null); }} /></label>
        <p>Use vírgula para centavos, por exemplo 150,00.</p>
        {precoCentavos !== null ? <p>Preço informado: {reais(precoCentavos)}.</p> : preco.trim() && <p role="alert">Informe um valor válido em reais, com até duas casas decimais.</p>}
        {sugestao !== null && <p>Preço sugerido: {reais(BigInt(sugestao))}. A sugestão aplica o fator à aquisição e soma os custos operacionais uma vez; piso e autorização dependem do servidor.</p>}
        <button type="button" disabled={!pronta || !atual || ocupado || sugestao === null} onClick={() => { if (sugestao !== null) { setPreco(centavosParaEntradaReais(sugestao)); setBasePrecoSugerido(baseSugestao); setConfirmacao(null); } }}>Usar preço sugerido</button>
        {sugestaoDesatualizada && <p role="alert">Fontes ou fator mudaram. Aplique a nova sugestão ou informe novamente o preço.</p>}
        <label><input type="checkbox" checked={confirmacao === fotografia && correlacoesProntas && !conflitoAtual} disabled={!pronta || !atual || !limites || !correlacoesProntas || sugestaoDesatualizada || conflitoAtual || ocupado || aquisicoes.length + parcelas.length === 0} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi as fontes, o preço e possíveis duplicidades.</label>
        <button type="submit" disabled={!permitirEdicao || !pronta || !atual || !limites || !correlacoesProntas || sugestaoDesatualizada || conflitoAtual || ocupado || precoCentavos === null || confirmacao !== fotografia || aquisicoes.length + parcelas.length === 0}>Salvar composição</button>
      </form>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
