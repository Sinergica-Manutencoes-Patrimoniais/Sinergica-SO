import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { listarParcelasOrcamento, prepararOrcamentoParcelas, prepararParcelasSchema, type PrepararOrcamentoParcelas } from "../../infrastructure/supabase-orcamento-operacional-adapter";
import { HistoricoFontes } from "./HistoricoFontes";
import { consolidarFontesCusto, type FonteCustoOperacional } from "../../domain/fontes-custo-operacional";
import { FontesAquisicao } from "./FontesAquisicao";
import { PrepararMisto } from "./PrepararMisto";
import { centavosParaEntradaReais, valorReaisParaCentavos } from "../../domain/valor-em-reais";

type Props = { usuario: string; cliente: string; propostaId: string; propostaRevisao: number; listaId: string; listaRevisao: number; permitirEdicao: boolean; aoSalvar: () => void };
type Grupo = "aquisicao" | "operacional";
type Selecao = { despesaId: string; vinculoId: string; despesaRevision: number; rateioRevision: number; valorCentavos: number; base: "previsto" | "realizado"; descricaoFonte: string; grupo: Grupo | "" };
const chaveFonte = (despesaId: string, vinculoId: string) => JSON.stringify([despesaId, vinculoId]);

export function PrepararParcelas(props: Props) {
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.propostaId, props.propostaRevisao, props.listaId, props.listaRevisao])} {...props} />;
}
function Conteudo({ usuario, cliente, propostaId, propostaRevisao, listaId, listaRevisao, permitirEdicao, aoSalvar }: Props) {
  const chave = `sso-composicao-parcelas:${JSON.stringify([usuario, cliente, propostaId])}`;
  const cache = useQueryClient();
  const [fontes, setFontes] = useState<Selecao[]>([]); const [descricao, setDescricao] = useState("");
  const [fator, setFator] = useState("1.5"); const [preco, setPreco] = useState(""); const [aviso, setAviso] = useState("");
  const [basePrecoSugerido, setBasePrecoSugerido] = useState<string | null>(null);
  const [confirmacaoFontes, setConfirmacaoFontes] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false); const trava = useRef(false);
  const [pendente, setPendente] = useState<PrepararOrcamentoParcelas | "invalido" | null>(() => { try {
    const valor = sessionStorage.getItem(chave); if (!valor) return null;
    const p = prepararParcelasSchema.parse(JSON.parse(valor));
    return p.atorId === usuario && p.clienteId === cliente && p.propostaId === propostaId && p.listaId === listaId ? p : "invalido";
  } catch { return "invalido"; } });
  const [mistoGuardado] = useState(() => {
    try { return sessionStorage.getItem(`sso-composicao-mista:${JSON.stringify([usuario, cliente, propostaId])}`) !== null; }
    catch { return true; }
  });
  const mistoAtivo = import.meta.env.VITE_SSO_COMPOSICAO_MISTA_ENABLED === "true" || mistoGuardado;
  const q = useInfiniteQuery({ queryKey: ["orcamento-parcelas", usuario, cliente, listaId], enabled: permitirEdicao, gcTime: 0,
    initialPageParam: null as { despesaId: string; vinculoId: string } | null,
    queryFn: ({ pageParam, signal }) => listarParcelasOrcamento(usuario, cliente, listaId, pageParam, signal),
    getNextPageParam: p => p.length === 30 ? { despesaId: p[p.length-1]!.despesa_id, vinculoId: p[p.length-1]!.vinculo_id } : undefined,
  });
  const linhas = q.data?.pages.flat() ?? [];
  const atual = fontes.every(f => linhas.some(l => l.despesa_id === f.despesaId && l.vinculo_id === f.vinculoId && l.despesa_revision === f.despesaRevision && l.rateio_revision === f.rateioRevision && l.valor_centavos === f.valorCentavos && l.base === f.base && l.descricao === f.descricaoFonte));
  const classificadas = fontes.length > 0 && fontes.every(f => f.grupo !== "");
  const fontesParaConsolidar: FonteCustoOperacional[] = fontes.flatMap((f) => f.grupo === "" ? [] : [{
    origem: "despesa_visita" as const, origemId: f.despesaId, parcelaId: f.vinculoId, grupo: f.grupo, valorCentavos: f.valorCentavos,
  }]);
  const consolidacao = consolidarFontesCusto(fontesParaConsolidar);
  const fontesValidas = classificadas && consolidacao.valido;
  const aquisicao = fontes.filter(f => f.grupo === "aquisicao").reduce((v,f) => v + BigInt(f.valorCentavos), 0n);
  const operacional = fontes.filter(f => f.grupo === "operacional").reduce((v,f) => v + BigInt(f.valorCentavos), 0n);
  function sugestao(): string | null {
    if (!/^\d{1,3}(?:\.\d{1,4})?$/.test(fator)) return null;
    const [inteiro = "0", fracao = ""] = fator.split("."); const mult = BigInt(inteiro) * 10000n + BigInt(fracao.padEnd(4,"0"));
    if (mult < 10000n || mult > 1000000n || aquisicao > 1000000000000n || operacional > 1000000000000n) return null;
    const valor = (aquisicao * mult + 5000n) / 10000n + operacional;
    return valor <= 1000000000000n ? valor.toString() : null;
  }
  const sugerido = sugestao();
  const precoCentavos = valorReaisParaCentavos(preco);
  const assinaturaPreco = JSON.stringify([fontes, fator]);
  const precoSugeridoDesatualizado = basePrecoSugerido !== null && basePrecoSugerido !== assinaturaPreco;
  const assinaturaConferencia = JSON.stringify([fontes, propostaRevisao, listaRevisao, descricao, fator, preco]);
  const fontesConfirmadas = confirmacaoFontes === assinaturaConferencia;
  const fontesAlteradas = fontes.flatMap((fonte) => {
    const linha = linhas.find((item) => item.despesa_id === fonte.despesaId && item.vinculo_id === fonte.vinculoId);
    if (!linha || (linha.despesa_revision === fonte.despesaRevision && linha.rateio_revision === fonte.rateioRevision && linha.valor_centavos === fonte.valorCentavos && linha.base === fonte.base && linha.descricao === fonte.descricaoFonte)) return [];
    return [{ fonte, linha }];
  });
  async function enviar(p: PrepararOrcamentoParcelas) {
    if (!permitirEdicao || trava.current) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); }
    catch { setAviso("Tentativa indisponível. Consulte suporte."); return; }
    trava.current = true; setOcupado(true); setAviso("");
    try {
      await prepararOrcamentoParcelas(p);
      await cache.invalidateQueries({ queryKey: ["orcamento-parcelas", usuario, cliente, listaId] });
      const atual=await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id!==usuario || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Sessão ou tentativa divergente.");
      sessionStorage.removeItem(chave); setPendente(null); setFontes([]); setDescricao(""); setPreco(""); setBasePrecoSugerido(null); setConfirmacaoFontes(null);
      try { aoSalvar(); setAviso("Composição registrada; nenhuma proposta foi enviada e nenhuma cobrança foi criada."); }
      catch { setAviso("Composição registrada, mas a tela não foi atualizada. Atualize antes de continuar."); }
    } catch { setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (mistoAtivo || !permitirEdicao || pendente || trava.current || q.isFetching || q.isError || !atual || !fontesValidas || !fontesConfirmadas || precoSugeridoDesatualizado || fontes.length === 0 || sugerido === null || precoCentavos === null) return;
    try {
      const p = prepararParcelasSchema.parse({ atorId: usuario, clienteId: cliente, requestId: crypto.randomUUID(), propostaId, expectedRevision: propostaRevisao, listaId, listaRevision: listaRevisao,
        descricao, fontes: fontes.map(f => ({ despesaId: f.despesaId, despesaRevision: f.despesaRevision, rateioRevision: f.rateioRevision, vinculoId: f.vinculoId, valorCentavos: f.valorCentavos, base: f.base, descricaoFonte: f.descricaoFonte, grupo: f.grupo })), fator: Number(fator), precoCentavos });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira fontes, descrição, fator, preço e armazenamento. Nada foi enviado."); }
  }
  if (!permitirEdicao && !pendente) return null;
  return <section aria-label="Preparar orçamento com parcelas"><h3>Composição por parcelas de despesa</h3>
    {import.meta.env.VITE_SSO_FONTES_AQUISICAO_ENABLED === "true" && <FontesAquisicao usuario={usuario} cliente={cliente} listaId={listaId} listaRevisao={listaRevisao} permitirEdicao={permitirEdicao} />}
    {mistoAtivo && <PrepararMisto key={JSON.stringify([usuario,cliente,propostaId,listaId])} usuario={usuario} cliente={cliente} propostaId={propostaId} propostaRevisao={propostaRevisao}
      listaId={listaId} listaRevisao={listaRevisao} permitirEdicao={permitirEdicao && !pendente} aoSalvar={aoSalvar} />}
    <HistoricoFontes usuario={usuario} cliente={cliente} propostaId={propostaId} versao={propostaRevisao} />
    <p>Confira cada gasto e sua classificação. Esta composição usa somente as parcelas de despesa selecionadas; não calcula automaticamente outros custos de materiais, mão de obra ou serviços. Valores previstos não comprovam gasto realizado; registros diferentes podem representar o mesmo gasto.</p>
    {q.isFetching && <output>Consultando parcelas…</output>}
    {q.isError && <p role="alert">Parcelas indisponíveis. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching && !q.isError && q.data && <>{linhas.length === 0 ? <p>Nenhuma parcela rateada encontrada para esta OS.</p> : <ul>{linhas.map(l => {
      const chaveItem = chaveFonte(l.despesa_id,l.vinculo_id); const selecionada = fontes.find(f => chaveFonte(f.despesaId,f.vinculoId) === chaveItem);
      return <li key={chaveItem}><label><input type="checkbox" checked={!!selecionada} disabled={ocupado || !!pendente} onChange={e => { const marcada=e.target.checked; setFontes(atualFontes => marcada ? [...atualFontes,{ despesaId:l.despesa_id,vinculoId:l.vinculo_id,despesaRevision:l.despesa_revision,rateioRevision:l.rateio_revision,valorCentavos:l.valor_centavos,base:l.base,descricaoFonte:l.descricao,grupo:"" }] : atualFontes.filter(f => chaveFonte(f.despesaId,f.vinculoId)!==chaveItem)); }} /> {l.descricao} · {l.valor_centavos} centavos · {l.base}</label>
        {selecionada && <label>Classificação <select required value={selecionada.grupo} disabled={ocupado || !!pendente} onChange={e => { const grupo = e.target.value as Grupo | ""; setFontes(itens => itens.map(f => chaveFonte(f.despesaId,f.vinculoId)===chaveItem ? {...f,grupo} : f)); }}><option value="">Selecione</option><option value="operacional">Operacional</option><option value="aquisicao">Aquisição</option></select></label>}</li>;
    })}</ul>}{q.hasNextPage && <button type="button" disabled={ocupado} onClick={() => void q.fetchNextPage()}>Mais parcelas</button>}</>}
    {!atual && <p role="alert">Uma parcela selecionada mudou ou não está carregada. Revise a seleção antes de salvar.</p>}
    {!q.isFetching && !q.isError && fontesAlteradas.length > 0 && <section aria-label="Parcelas alteradas">
      <h4>Conferir alterações das parcelas</h4>
      {fontesAlteradas.map(({ fonte, linha }) => <article key={chaveFonte(fonte.despesaId, fonte.vinculoId)}>
        <p>Antes: {fonte.descricaoFonte} · {fonte.valorCentavos} centavos · {fonte.base} · revisão da despesa {fonte.despesaRevision} · revisão do rateio {fonte.rateioRevision}.</p>
        <p>Agora: {linha.descricao} · {linha.valor_centavos} centavos · {linha.base} · revisão da despesa {linha.despesa_revision} · revisão do rateio {linha.rateio_revision}.</p>
        <p>Ao adotar a parcela atual, escolha novamente sua classificação e confirme novamente as fontes e o preço.</p>
        <button type="button" disabled={ocupado || !!pendente || !permitirEdicao} onClick={() => {
          setFontes((anteriores) => anteriores.map((item) => chaveFonte(item.despesaId, item.vinculoId) === chaveFonte(fonte.despesaId, fonte.vinculoId)
            ? { ...item, despesaRevision: linha.despesa_revision, rateioRevision: linha.rateio_revision, valorCentavos: linha.valor_centavos, base: linha.base, descricaoFonte: linha.descricao, grupo: "" }
            : item));
          setConfirmacaoFontes(null);
        }}>Adotar parcela atual</button>
      </article>)}
    </section>}
    {fontes.length > 0 && !classificadas && <p role="alert">Classifique cada parcela selecionada antes de calcular ou salvar.</p>}
    {classificadas && !consolidacao.valido && <p role="alert">As fontes selecionadas são inválidas, duplicadas ou ultrapassam o limite. Revise antes de continuar.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível ou de outro contexto. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <p>Resultado anterior não confirmado. <button type="button" disabled={ocupado || !permitirEdicao} onClick={() => void enviar(pendente)}>Repetir tentativa</button></p> : !pendente && <form onSubmit={e => { e.preventDefault(); iniciar(); }}>
      <p>Aquisição: {aquisicao.toString()} centavos · Operacional: {operacional.toString()} centavos.</p>
      <label>Descrição <textarea required maxLength={4000} value={descricao} onChange={e => setDescricao(e.target.value)} /></label>
      <label>Fator <input type="number" min="1" max="100" step="0.0001" required value={fator} onChange={e => setFator(e.target.value)} /></label>
      <label>Preço de venda em reais <input type="text" inputMode="decimal" maxLength={24} required value={preco} onChange={e => { setPreco(e.target.value); setBasePrecoSugerido(null); }} /></label>
      <p>Use vírgula para centavos, por exemplo 150,00.</p>
      {preco.trim() && precoCentavos === null && <p role="alert">Informe um valor válido em reais, com até duas casas decimais.</p>}
      {precoSugeridoDesatualizado && <p role="alert">As fontes ou o fator mudaram desde a sugestão. Aplique a nova sugestão ou informe novamente o preço para confirmar a escolha.</p>}
      {sugerido !== null && classificadas && <p>Preço sugerido: {sugerido} centavos. O servidor verifica valores e piso.</p>}
      <button type="button" disabled={sugerido === null || !fontesValidas || ocupado} onClick={() => { if (sugerido !== null && fontesValidas) { setPreco(centavosParaEntradaReais(sugerido)); setBasePrecoSugerido(assinaturaPreco); } }}>Usar preço sugerido</button>
      <label><input type="checkbox" checked={fontesConfirmadas} disabled={!atual || !fontesValidas || q.isFetching || q.isError || ocupado} onChange={e => setConfirmacaoFontes(e.target.checked ? assinaturaConferencia : null)} /> Conferi as parcelas, sua classificação e os custos que ainda precisam ser considerados.</label>
      <button type="submit" disabled={mistoAtivo || ocupado || !permitirEdicao || q.isFetching || q.isError || !atual || !fontesValidas || !fontesConfirmadas || precoSugeridoDesatualizado || precoCentavos === null || fontes.length===0}>Salvar composição</button>
    </form>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
