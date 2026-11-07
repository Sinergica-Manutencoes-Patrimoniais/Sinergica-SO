import { useLayoutEffect, useRef, useState } from "react";
import type { FiltroFotografiaExportacao } from "../../application/exportacao-fotografia";
import { prepararCronogramaAutenticado } from "../../infrastructure/exportacao-cronograma-autenticada";
import { consultarFeriadosCronograma } from "../../infrastructure/feriados-cronograma";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCalendarioContratualAdapter } from "../../infrastructure/supabase-calendario-contratual-adapter";
import { z } from "zod";
import { SelecionarAlvoCronograma } from "./SelecionarAlvoCronograma";
import { consultarCapacidadeCronograma } from "../../infrastructure/capacidade-cronograma";

/** Integração experimental desligada; gates dependem de revisão e testes oficiais. */
export function ExportarCronogramaFotografia({ userId, clienteId, planoId, versaoId }: { userId: string; clienteId: string; planoId: string; versaoId: string }) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [alvoTipo, setAlvoTipo] = useState<"" | "sistema" | "componente" | "grupo">("");
  const [alvoId, setAlvoId] = useState("");
  const [fotografiaAlvo, setFotografiaAlvo] = useState<string | null>(null);
  const [modo, setModo] = useState<"" | "calendario" | "visita">("");
  const [feriado, setFeriado] = useState("");
  const [feriados, setFeriados] = useState<string[]>([]);
  const [usarDeclarados, setUsarDeclarados] = useState(false);
  const [incluirCapacidade, setIncluirCapacidade] = useState(false);
  const [periodoCapacidade, setPeriodoCapacidade] = useState<{ inicio: string; fim: string } | null>(null);
  const [contratoDeclarado, setContratoDeclarado] = useState("");
  const [consultaFeriados, setConsultaFeriados] = useState<{ inicio: string; fim: string; contrato: string } | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const chave = JSON.stringify([userId, clienteId, planoId, versaoId]);
  const contextoAtual = useRef(chave);
  contextoAtual.current = chave;
  const ativo = useRef<AbortController | null>(null);
  const contratos = useInfiniteQuery({
    queryKey: ["cronograma-contratos", userId, clienteId], enabled: usarDeclarados && import.meta.env.VITE_SSO_CRONOGRAMA_FERIADOS_DECLARADOS_ENABLED === "true",
    initialPageParam: null as string | null, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const pagina = await supabaseCalendarioContratualAdapter.listarContratos(clienteId, 20, pageParam, signal);
      if (pagina.length > 20) throw new Error("Página excede limite.");
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const contrato of pagina) { const id = contrato.id.toLowerCase(); if (id <= anterior) throw new Error("Página divergente."); anterior = id; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined,
  });
  const contratosCarregados = contratos.data?.pages.flat() ?? [];
  const periodoDias = (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000;
  const periodoValido = Number.isFinite(periodoDias) && periodoDias >= 0 && periodoDias <= 366;
  const contratosDivergentes = contratosCarregados.some((contrato, indice) => indice > 0 &&
    contrato.id.toLowerCase() <= contratosCarregados[indice - 1]!.id.toLowerCase());
  const escopoDisponivel = !contratoDeclarado || (!contratos.isFetching && !contratos.isError && !contratosDivergentes && contratosCarregados.some((c) => c.id === contratoDeclarado));
  const consultaAtual = !!consultaFeriados && usarDeclarados && periodoValido && escopoDisponivel && consultaFeriados.inicio === inicio && consultaFeriados.fim === fim && consultaFeriados.contrato === contratoDeclarado;
  const declaracoes = useQuery({
    queryKey: ["cronograma-feriados-previa", userId, clienteId, consultaFeriados], enabled: consultaAtual, gcTime: 0, retry: false,
    queryFn: ({ signal }) => {
      if (!consultaFeriados) throw new Error("Consulta indisponível.");
      return consultarFeriadosCronograma(userId, clienteId, consultaFeriados.contrato || null, consultaFeriados.inicio, consultaFeriados.fim, signal);
    },
  });
  const capacidadeAtual = incluirCapacidade && periodoValido && periodoCapacidade?.inicio === inicio && periodoCapacidade?.fim === fim;
  const capacidade = useQuery({ queryKey: ["cronograma-capacidade-previa", userId, clienteId, periodoCapacidade], enabled: capacidadeAtual, gcTime: 0, retry: false,
    queryFn: ({ signal }) => {
      if (!periodoCapacidade) throw new Error("Período indisponível.");
      return consultarCapacidadeCronograma(userId, clienteId, periodoCapacidade.inicio, periodoCapacidade.fim, signal);
    } });

  useLayoutEffect(() => {
    setOcupado(false); setErro(""); setInicio(""); setFim(""); setAlvoTipo(""); setAlvoId(""); setFotografiaAlvo(null); setModo(""); setFeriado(""); setFeriados([]); setUsarDeclarados(false); setIncluirCapacidade(false); setPeriodoCapacidade(null); setContratoDeclarado(""); setConsultaFeriados(null); setSeletorAberto(false);
    return () => { ativo.current?.abort(); ativo.current = null; };
  }, [chave]);

  async function exportar(formato: "pdf" | "xlsx") {
    if (ativo.current) return;
    const inicioMs = Date.parse(`${inicio}T00:00:00Z`);
    const fimMs = Date.parse(`${fim}T00:00:00Z`);
    if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs) || fimMs < inicioMs || fimMs - inicioMs > 366 * 86_400_000) {
      setErro("Informe um período válido de até 366 dias de diferença."); return;
    }
    if (feriados.some((data) => data < inicio || data > fim)) {
      setErro("Há feriados informados fora do período selecionado. Remova-os ou ajuste o período."); return;
    }
    if (alvoId.trim() && !z.string().guid().safeParse(alvoId.trim()).success) {
      setErro("Informe um identificador de alvo válido ou deixe o campo vazio."); return;
    }
    if (usarDeclarados && contratoDeclarado && (contratos.isFetching || contratos.isError || contratosDivergentes || !contratosCarregados.some((c) => c.id === contratoDeclarado))) {
      setErro("O contrato selecionado não está disponível. Atualize a consulta ou escolha o escopo geral."); return;
    }
    const filtro: FiltroFotografiaExportacao = {};
    if (alvoTipo) filtro.alvoTipo = alvoTipo;
    if (alvoId.trim()) filtro.alvoId = alvoId.trim();
    if (fotografiaAlvo) filtro.snapshotHashSelecionado = fotografiaAlvo;
    if (modo) filtro.modo = modo;
    const controle = new AbortController();
    ativo.current = controle; setErro(""); setOcupado(true);
    try {
      const contrato = contratoDeclarado || null;
      const declarados = usarDeclarados ? await consultarFeriadosCronograma(userId, clienteId, contrato, inicio, fim, controle.signal) : null;
      const datas = [...new Set([...feriados, ...(declarados?.datas ?? [])])].sort();
      const arquivo = await prepararCronogramaAutenticado(userId, { clienteId, planoId, versaoId }, { inicio, fim, feriadosInformados: datas, ...(declarados ? { declaracoes: { contratoId: contrato, datas: declarados.datas } } : {}) }, filtro, formato, controle.signal, incluirCapacidade);
      if (declarados && (await consultarFeriadosCronograma(userId, clienteId, contrato, inicio, fim, controle.signal)).conteudo !== declarados.conteudo)
        throw new Error("Declarações alteradas durante a exportação.");
      const sessaoFinal = await supabase.auth.getUser();
      if (sessaoFinal.error || sessaoFinal.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (controle.signal.aborted || contextoAtual.current !== chave || ativo.current !== controle) return;
      const url = URL.createObjectURL(arquivo);
      try { const link = document.createElement("a"); link.href = url; link.download = `cronograma-parcial.${formato}`; link.click(); }
      finally { URL.revokeObjectURL(url); }
    } catch {
      if (!controle.signal.aborted && contextoAtual.current === chave) setErro("Não foi possível exportar. Confira acesso, período, filtro e dados disponíveis.");
    } finally {
      if (ativo.current === controle) { ativo.current = null; setOcupado(false); }
    }
  }

  return <section aria-label="Exportação de cronograma parcial">
    <p>Cronograma parcial: cobertura desconhecida e sem confirmação de execução. Feriados oficiais não foram consultados.</p>
    <fieldset disabled={ocupado}>
    <label>Início do cronograma <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
    <label>Fim do cronograma <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
    <label>Tipo de alvo <select value={alvoTipo} onChange={(e) => { setFotografiaAlvo(null); setAlvoId(""); setAlvoTipo(e.target.value as typeof alvoTipo); }}><option value="">Todos</option><option value="sistema">Sistema</option><option value="componente">Componente</option><option value="grupo">Grupo Quantitativo</option></select></label>
    <label>Identificador do alvo, opcional <input value={alvoId} onChange={(e) => { setFotografiaAlvo(null); setAlvoId(e.target.value); }} /></label>
    <p>O identificador filtra a fotografia aprovada; deixe em branco para incluir todos os alvos do tipo selecionado.</p>
    {import.meta.env.VITE_SSO_ALVOS_CRONOGRAMA_ENABLED === "true" && <>
      <button type="button" aria-expanded={seletorAberto} onClick={() => setSeletorAberto((atual) => !atual)}>{seletorAberto ? "Ocultar alvos" : "Selecionar alvo por nome"}</button>
      {seletorAberto && <SelecionarAlvoCronograma userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} onSelecionar={(tipo, id, hash) => { setAlvoTipo(tipo); setAlvoId(id); setFotografiaAlvo(hash); setSeletorAberto(false); }} />}
    </>}
    <label>Modo da Rotina <select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}><option value="">Todos</option><option value="calendario">Por calendário</option><option value="visita">Por Visita</option></select></label>
    {import.meta.env.VITE_SSO_CAPACIDADE_CRONOGRAMA_ENABLED === "true" && <><label><input type="checkbox" checked={incluirCapacidade} onChange={(e) => setIncluirCapacidade(e.target.checked)} /> Incluir capacidade declarada parcial por semana</label>
      <p>Somente totais informados de tempo destinado, reservas e ausências. Não calcula saldo, não verifica sobreposição de intervalos nem comprova cobertura. A consulta pode demorar em períodos longos.</p>
      {incluirCapacidade && <><button type="button" disabled={!periodoValido || capacidade.isFetching} onClick={() => {
        if (capacidadeAtual) void capacidade.refetch(); else setPeriodoCapacidade({ inicio, fim });
      }}>Consultar capacidade parcial</button>
        {capacidadeAtual && capacidade.isFetching && <output>Consultando capacidade…</output>}
        {capacidadeAtual && capacidade.isError && <p role="alert">Capacidade indisponível. Confira acesso e período.</p>}
        {capacidadeAtual && !capacidade.isFetching && !capacidade.isError && capacidade.data && <><p>Declarações encontradas por semana; reconsultadas ao exportar. Dados não representam saldo nem cobertura completa.</p>
          <ul>{capacidade.data.map((semana) => <li key={semana.semana}>Semana {semana.semana}: {semana.registros} registro(s), {semana.destinados} min destinados, {semana.reservas} min de reservas, {semana.ausencias} min de ausências{semana.limiteAtingido ? " · limite de registros atingido" : ""}.</li>)}</ul></>}
      </>}</>}
    <p>Datas informadas aqui servem somente para esta exportação; não registram feriados nem comprovam cobertura.</p>
    {import.meta.env.VITE_SSO_CRONOGRAMA_FERIADOS_DECLARADOS_ENABLED === "true" && <>
      <label><input type="checkbox" checked={usarDeclarados} onChange={(e) => setUsarDeclarados(e.target.checked)} /> Consultar também declarações cadastradas para este Cliente</label>
      {usarDeclarados && <><label>Escopo de contrato <select value={contratoDeclarado} disabled={contratos.isFetching || contratos.isError || contratosDivergentes} onChange={(e) => setContratoDeclarado(e.target.value)}>
        <option value="">Somente geral do Cliente</option>
        {!contratosDivergentes && contratosCarregados.map((c) => <option key={c.id} value={c.id}>{c.tipo} · {c.status} · {c.vigenciaInicio} a {c.vigenciaFim ?? "sem término"} · {c.id}</option>)}
      </select></label>
        {contratos.isFetching && <output>Consultando contratos…</output>}
        {contratos.isError && <p role="alert">Contratos indisponíveis. <button type="button" onClick={() => void contratos.refetch()}>Tentar novamente</button></p>}
        {contratosDivergentes && <p role="alert">Páginas de contratos divergentes. <button type="button" onClick={() => void contratos.refetch()}>Atualizar</button></p>}
        {contratos.hasNextPage && !contratosDivergentes && <button type="button" disabled={contratos.isFetching} onClick={() => void contratos.fetchNextPage()}>Mais contratos</button>}
        <p>Sem contrato, consulta somente declarações gerais. A escolha do contrato não comprova vínculo com este Plano; a fonte não é oficial nem garante cobertura.</p>
        <button type="button" disabled={!periodoValido || declaracoes.isFetching || !escopoDisponivel} onClick={() => {
          if (consultaAtual) void declaracoes.refetch(); else setConsultaFeriados({ inicio, fim, contrato: contratoDeclarado });
        }}>Consultar datas declaradas</button>
        {consultaAtual && declaracoes.isFetching && <output>Consultando datas declaradas…</output>}
        {consultaAtual && declaracoes.isError && <p role="alert">Datas declaradas indisponíveis. Confira acesso e período.</p>}
        {consultaAtual && !declaracoes.isFetching && !declaracoes.isError && declaracoes.data && <><p>Datas declaradas encontradas para o escopo e período consultados; lista não comprova cobertura oficial.</p>
          {declaracoes.data.datas.length ? <ul aria-label="Datas declaradas consultadas">{declaracoes.data.datas.map((data) => <li key={data}>{data}</li>)}</ul> : <p>Nenhuma data declarada neste escopo e período.</p>}</>}
      </>}
    </>}
    <label>Data de feriado informado <input type="date" min={inicio || undefined} max={fim || undefined} value={feriado} onChange={(e) => setFeriado(e.target.value)} /></label>
    <button type="button" disabled={!feriado || !inicio || !fim || feriado < inicio || feriado > fim || feriados.length >= 367} onClick={() => { if (feriado && inicio && fim && feriado >= inicio && feriado <= fim) setFeriados((atual) => [...new Set([...atual, feriado])].sort()); setFeriado(""); }}>Adicionar feriado informado</button>
    {feriados.length > 0 && <ul>{feriados.map((data) => <li key={data}>{data} <button type="button" onClick={() => setFeriados((atual) => atual.filter((item) => item !== data))} aria-label={`Remover feriado ${data}`}>Remover</button></li>)}</ul>}
    </fieldset>
    <button type="button" disabled={ocupado} onClick={() => void exportar("pdf")}>Exportar cronograma parcial em PDF</button>
    <button type="button" disabled={ocupado} onClick={() => void exportar("xlsx")}>Exportar cronograma parcial em XLSX</button>
    {ocupado && <output>Preparando e conferindo cronograma...</output>}
    {erro && <p role="alert">{erro}</p>}
  </section>;
}
