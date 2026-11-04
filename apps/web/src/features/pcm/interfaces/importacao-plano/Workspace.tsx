import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { MapeamentoLinha } from "./MapeamentoLinha";
import { CompararLotes } from "./CompararLotes";
import { RevisaoLinha } from "./RevisaoLinha";
import { ClassificacaoLinha } from "./ClassificacaoLinha";
import { ConferenciaIntegrada } from "./ConferenciaIntegrada";
import { AprovarLote } from "./AprovarLote";
import { IncorporarLinha } from "./IncorporarLinha";
import { PreviaXlsx } from "./PreviaXlsx";
import { ProgramacaoLinha } from "./ProgramacaoLinha";
import { preverImportacaoPlano } from "../../application/prever-importacao-plano";
import { lerMatrizCronogramaCsv } from "../../application/matriz-cronograma-csv";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { enviarXlsxAutenticado, reconciliarXlsxAutenticado } from "../../infrastructure/enviar-xlsx-autenticado";
import {
  anotarRevisaoCronograma,
  listarCronogramasStaging,
  obterCronogramaStaging,
  receberMatrizCronograma,
  type PedidoMatriz,
  type PedidoRevisao,
} from "../../infrastructure/supabase-importacao-plano-adapter";

type Tentativa =
  | { tipo: "recepcao"; pedido: PedidoMatriz }
  | { tipo: "revisao"; pedido: PedidoRevisao };

export function ImportacaoPlanoWorkspace({
  userId,
  clienteId,
}: { userId: string; clienteId: string }) {
  return <Conteudo key={JSON.stringify([userId, clienteId])} userId={userId} clienteId={clienteId} />;
}

function Conteudo({ userId, clienteId }: { userId: string; clienteId: string }) {
  const envioXlsxHabilitado = (import.meta.env.DEV && import.meta.env.VITE_SSO_ENVIO_XLSX_DEV_ENABLED === "true") || import.meta.env.VITE_SSO_ENVIO_XLSX_ENABLED === "true";
  const storageKey = `sso-cronograma:${JSON.stringify([userId, clienteId])}`;
  const travaEnvio = useRef(false);
  const client = useQueryClient();
  const [fonte, setFonte] = useState("");
  const [xlsxBloqueado, setXlsxBloqueado] = useState(false);
  const [matriz, setMatriz] = useState("");
  const [previa, setPrevia] = useState<{ assinatura: string; linhas: ReturnType<typeof preverImportacaoPlano> } | null>(null);
  const [confirmacaoPrevia, setConfirmacaoPrevia] = useState<string | null>(null);
  const [paginaPrevia, setPaginaPrevia] = useState(0);
  const [erroPrevia, setErroPrevia] = useState("");
  const [csv, setCsv] = useState<string[][] | null>(null);
  const [erroCsv, setErroCsv] = useState("");
  const [anotacoes, setAnotacoes] = useState<Record<string, { linha: string; observacao: string }>>({});
  const [csvLendo, setCsvLendo] = useState(false);
  const leituraCsv = useRef(0);
  const arquivoCsv = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState<Tentativa | "invalida" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (!salvo) return null;
      const v = JSON.parse(salvo) as Tentativa;
      if (
        v?.tipo === "recepcao" &&
        v.pedido?.clienteId === clienteId &&
        typeof v.pedido.requestId === "string" &&
        typeof v.pedido.loteId === "string" &&
        Array.isArray(v.pedido.matriz)
      )
        return v;
      if (
        v?.tipo === "revisao" &&
        typeof v.pedido?.requestId === "string" &&
        typeof v.pedido.loteId === "string" &&
        Number.isSafeInteger(v.pedido.expectedRevision) &&
        Number.isSafeInteger(v.pedido.numeroLinha) &&
        typeof v.pedido.observacao === "string"
      )
        return v;
      return "invalida";
    } catch {
      return "invalida";
    }
  });
  async function conferirSessao(signal?: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const permissao = useQuery({
    queryKey: ["importacao-plano", userId, clienteId, "permissao"],
    queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const resultado = await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId);
      await conferirSessao(signal);
      return resultado;
    },
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const lotes = useInfiniteQuery({
    queryKey: ["importacao-plano", userId, clienteId, "lotes"],
    enabled: permitido,
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const pagina = await listarCronogramasStaging(clienteId, pageParam, signal);
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  const envioXlsx = useMutation({
    mutationFn: async (pedido: { fonteId: string; bytes: Uint8Array }) => {
      await conferirSessao();
      if (await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId) !== true) throw new Error("Acesso indisponível.");
      await conferirSessao();
      return enviarXlsxAutenticado({ userId, clienteId, fonteId: pedido.fonteId, bytes: pedido.bytes }, localStorage, navigator.locks ?? null);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["importacao-plano", userId, clienteId, "lotes"] }),
  });
  const reconciliacaoXlsx = useMutation({ mutationFn: async (pedido: { fonteId: string; bytes: Uint8Array }) => {
    await conferirSessao();
    if (await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId) !== true) throw new Error("Acesso indisponível.");
    await conferirSessao();
    return reconciliarXlsxAutenticado({ userId, clienteId, fonteId: pedido.fonteId, bytes: pedido.bytes }, localStorage, navigator.locks ?? null);
  } });
  const envio = useMutation({
    mutationFn: async (t: Tentativa) => {
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(t)) throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const resultado = await (t.tipo === "recepcao" ? receberMatrizCronograma(t.pedido) : anotarRevisaoCronograma(t.pedido));
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return resultado;
    },
    onSuccess: async (_resultado, enviada) => {
      await client.invalidateQueries({
        queryKey: ["importacao-plano", userId, clienteId, "lotes"],
      });
      try {
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(enviada)) {
          setAviso("Operação concluída, mas há outra tentativa local. Reabra para conferi-la.");
          return;
        }
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso("Operação concluída, mas tentativa local não pôde ser removida. Procure suporte.");
        return;
      }
      if (enviada.tipo === "revisao") {
        const chave = JSON.stringify([enviada.pedido.loteId, enviada.pedido.expectedRevision]);
        setAnotacoes((anteriores) => {
          const rascunho = anteriores[chave];
          if (!rascunho || rascunho.linha !== String(enviada.pedido.numeroLinha) || rascunho.observacao.trim() !== enviada.pedido.observacao) return anteriores;
          const proximos = { ...anteriores }; delete proximos[chave]; return proximos;
        });
      }
      setTentativa(null);
      setAviso("Registro guardado em staging; não foi aprovado nem incorporado.");
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado. Repita a mesma tentativa; procure suporte em caso de conflito.",
      ),
    onSettled: () => { travaEnvio.current = false; },
  });
  const enviar = (t: Tentativa, repetir = false) => {
    if (travaEnvio.current) return;
    try {
      const salva = sessionStorage.getItem(storageKey);
      if (repetir && salva !== JSON.stringify(t)) {
        setAviso("Tentativa local alterada. Reabra para conferi-la antes de repetir.");
        return;
      }
      if (!repetir && salva !== null) {
        setAviso("Há uma tentativa anterior nesta sessão. Reabra para conferi-la.");
        return;
      }
      if (!repetir) sessionStorage.setItem(storageKey, JSON.stringify(t));
    } catch {
      setAviso("Não foi possível guardar a tentativa; nada foi enviado.");
      return;
    }
    setTentativa(t);
    setAviso("");
    travaEnvio.current = true;
    envio.mutate(t);
  };
  const assinaturaPrevia = JSON.stringify([clienteId, fonte.trim(), matriz]);
  const previaAtual = previa?.assinatura === assinaturaPrevia ? previa.linhas : null;
  function conferirPrevia() {
    try {
      if (!fonte.trim() || fonte.trim().length > 188 || new TextEncoder().encode(matriz).length > 1_048_576) throw new Error();
      const dados: unknown = JSON.parse(matriz);
      if (!Array.isArray(dados) || !dados.every(Array.isArray)) throw new Error();
      const linhas = preverImportacaoPlano({ CRONOGRAMA: dados }, fonte.trim(), clienteId, [], {});
      if (!linhas.length) throw new Error();
      setPrevia({ assinatura: assinaturaPrevia, linhas }); setPaginaPrevia(0); setErroPrevia("");
    } catch { setPrevia(null); setErroPrevia("Não foi possível conferir a matriz. Verifique o cabeçalho e o limite de 1 MiB."); }
  }
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso ao cronograma…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return null;
  return (
    <section aria-label="Conferência de cronograma">
      <h2>Conferência de cronograma</h2>
      <p>
        Importe CSV UTF-8 separado por ponto e vírgula ou informe matriz JSON. A recepção XLSX atestada depende de validação; a prévia local não autentica o arquivo. Guardar a matriz cria apenas um lote em staging; a incorporação é uma operação separada.
      </p>
      <label>
        Arquivo CSV do cronograma
        <input ref={arquivoCsv} type="file" accept=".csv,text/csv" disabled={!!tentativa || envio.isPending || envioXlsx.isPending || reconciliacaoXlsx.isPending || xlsxBloqueado} onChange={async (e) => {
          const arquivo = e.currentTarget.files?.[0]; const leitura = ++leituraCsv.current;
          setCsv(null); setErroCsv("");
          setCsvLendo(!!arquivo);
          if (!arquivo) return;
          try {
            if (!arquivo.name.toLowerCase().endsWith(".csv") || arquivo.size > 1_048_576) throw new Error("Selecione CSV de até 1 MiB.");
            const conteudo = new TextDecoder("utf-8", { fatal: true }).decode(await arquivo.arrayBuffer());
            const dados = lerMatrizCronogramaCsv(conteudo);
            if (leitura === leituraCsv.current) setCsv(dados);
          } catch {
            if (leitura === leituraCsv.current) setErroCsv("CSV inválido, não UTF-8 ou acima dos limites. Nenhum dado foi enviado.");
          } finally {
            if (leitura === leituraCsv.current) setCsvLendo(false);
          }
        }} />
      </label>
      {csvLendo && <p role="status">Lendo CSV…</p>}
      {erroCsv && <p role="alert">{erroCsv}</p>}
      {csv && <p>{csv.length} linhas lidas como texto, sem interpretar datas, códigos ou fórmulas. <button type="button" disabled={!!tentativa || envio.isPending || envioXlsx.isPending || reconciliacaoXlsx.isPending} onClick={() => { setMatriz(JSON.stringify(csv)); setCsv(null); if (arquivoCsv.current) arquivoCsv.current.value = ""; }}>Usar CSV na matriz de conferência</button></p>}
      {(csvLendo || csv || erroCsv) && <button type="button" disabled={!!tentativa || envio.isPending || envioXlsx.isPending || reconciliacaoXlsx.isPending} onClick={() => { leituraCsv.current++; setCsvLendo(false); setCsv(null); setErroCsv(""); if (arquivoCsv.current) arquivoCsv.current.value = ""; }}>Descartar seleção CSV</button>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (tentativa || envioXlsx.isPending || reconciliacaoXlsx.isPending || xlsxBloqueado || csvLendo || csv || erroCsv || !previaAtual || confirmacaoPrevia !== assinaturaPrevia) return;
          try {
            const dados: unknown = JSON.parse(matriz);
            if (
              !Array.isArray(dados) ||
              !dados.every(Array.isArray) ||
              !fonte.trim() ||
              fonte.trim().length > 188
            )
              throw new Error();
            const linhas = preverImportacaoPlano(
              { CRONOGRAMA: dados },
              fonte.trim(),
              clienteId,
              [],
              {},
            );
            if (!linhas.length) throw new Error();
            enviar({
              tipo: "recepcao",
              pedido: {
                requestId: crypto.randomUUID(),
                loteId: crypto.randomUUID(),
                clienteId,
                fonteId: fonte.trim(),
                matriz: dados,
              },
            });
          } catch {
            setAviso("Matriz ou cabeçalho inválido; confira o formato do cronograma.");
          }
        }}
      >
        <fieldset disabled={!!tentativa || envio.isPending || envioXlsx.isPending || reconciliacaoXlsx.isPending || xlsxBloqueado || csvLendo || !!csv || !!erroCsv}>
          <label>
            Identificação da fonte{" "}
            <input
              required
              maxLength={188}
              value={fonte}
              onChange={(e) => setFonte(e.target.value)}
            />
          </label>
          <label>
            Matriz JSON da aba CRONOGRAMA{" "}
            <textarea required value={matriz} onChange={(e) => setMatriz(e.target.value)} />
          </label>
          <button type="button" onClick={conferirPrevia}>Conferir matriz antes de receber</button>
          {erroPrevia && <p role="alert">{erroPrevia}</p>}
          {previa && !previaAtual && <p role="status">A fonte ou a matriz mudou; faça nova conferência para atualizar a prévia.</p>}
          {previaAtual && <section aria-label="Prévia da matriz de cronograma">
            <h3>Prévia para conferência</h3>
            <p>{previaAtual.length} linha(s); {previaAtual.filter((item) => item.conferencia.erros.length > 0).length} com pendências sinalizadas. Alvos e recorrências ainda não foram mapeados; esta prévia não aprova nem grava dados.</p>
            <ul>{previaAtual.slice(paginaPrevia * 50, (paginaPrevia + 1) * 50).map(({ original, conferencia }) => <li key={original.numeroLinha}>
              Linha {original.numeroLinha} · {String(original.disciplina)} · código {String(original.codigoOriginal)} · periodicidade {String(original.periodicidadeOriginal)} · pendências {conferencia.erros.join(", ") || "nenhuma sinalizada"}
              <ProgramacaoLinha semanas={conferencia.semanas} />
            </li>)}</ul>
            {previaAtual.length > 50 && <nav aria-label="Páginas da prévia"><button type="button" disabled={paginaPrevia === 0} onClick={() => setPaginaPrevia((pagina) => pagina - 1)}>Página anterior da prévia</button>{" "}
              <span>Página {paginaPrevia + 1} de {Math.ceil(previaAtual.length / 50)}</span>{" "}
              <button type="button" disabled={(paginaPrevia + 1) * 50 >= previaAtual.length} onClick={() => setPaginaPrevia((pagina) => pagina + 1)}>Próxima página da prévia</button></nav>}
          </section>}
          {previaAtual && <label><input type="checkbox" checked={confirmacaoPrevia === assinaturaPrevia} onChange={(e) => setConfirmacaoPrevia(e.target.checked ? assinaturaPrevia : null)} /> Conferi esta matriz e suas pendências para o Cliente selecionado.</label>}
          <button type="submit" disabled={!previaAtual || confirmacaoPrevia !== assinaturaPrevia}>Guardar em staging</button>
        </fieldset>
      </form>
      {import.meta.env.VITE_SSO_PREVIA_XLSX_ENABLED === "true" && !!fonte.trim() && !tentativa && !envio.isPending && !csvLendo && !csv && !erroCsv && <PreviaXlsx key={JSON.stringify([userId, clienteId, fonte.trim()])} fonteId={fonte.trim()} clienteId={clienteId}
        aoAlterarBloqueio={setXlsxBloqueado}
        usarMatrizDeclarada={import.meta.env.VITE_SSO_CRONOGRAMA_MATRIZ_XLSX_LOCAL_ENABLED === "true" ? (valores) => { setMatriz(JSON.stringify(valores)); setPrevia(null); setPaginaPrevia(0); setErroPrevia(""); setAviso("Valores copiados para a matriz manual. Confira antes de guardar; arquivo não autenticado."); } : undefined}
        enviarExperimental={envioXlsxHabilitado ? async (bytes) => { await envioXlsx.mutateAsync({ fonteId: fonte.trim(), bytes }); } : undefined}
        reconciliarExperimental={envioXlsxHabilitado ? async (bytes) => { await reconciliacaoXlsx.mutateAsync({ fonteId: fonte.trim(), bytes }); } : undefined} />}
      {tentativa === "invalida" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {tentativa && tentativa !== "invalida" && (
        <p>
          Há uma tentativa pendente guardada nesta sessão.{" "}
          <button type="button" disabled={envio.isPending} onClick={() => enviar(tentativa, true)}>
            Repetir tentativa
          </button>
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      {lotes.isFetching && <output>Carregando lotes…</output>}
      {lotes.isError && (
        <p role="alert">
          Não foi possível carregar lotes.{" "}
          <button type="button" onClick={() => void lotes.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!lotes.isFetching && !lotes.isError && (
        <>
          {import.meta.env.VITE_SSO_COMPARAR_CRONOGRAMA_ENABLED === "true" && <CompararLotes userId={userId} clienteId={clienteId} lotes={lotes.data?.pages.flat() ?? []} />}
          <ul>
            {lotes.data?.pages.flat().map((lote) => (
              <li key={lote.id}>
                {lote.fonte} · revisão {lote.revisao}{" "}
                <button type="button" onClick={() => setSelecionado(lote.id)}>
                  Conferir linhas
                </button>
                {selecionado === lote.id && <nav aria-label="Etapas do cronograma selecionado"><p>Ir para: <a href="#cronograma-detalhe">linhas</a> · <a href="#cronograma-mapeamento">mapeamento</a>
                  {import.meta.env.VITE_SSO_REVISAO_LINHA_CRONOGRAMA_ENABLED === "true" && <> · <a href="#cronograma-revisao">revisão</a></>}
                  {import.meta.env.VITE_SSO_CLASSIFICACAO_CRONOGRAMA_ENABLED === "true" && <> · <a href="#cronograma-classificacao">classificação</a></>}
                  {import.meta.env.VITE_SSO_CONFERENCIA_INTEGRADA_CRONOGRAMA_ENABLED === "true" && <> · <a href="#cronograma-conferencia">conferência</a></>}
                  {import.meta.env.VITE_SSO_APROVAR_CRONOGRAMA_STAGING_ENABLED === "true" && <> · <a href="#cronograma-aprovacao">aprovação em staging</a></>}
                  {import.meta.env.VITE_SSO_INCORPORAR_CRONOGRAMA_ENABLED === "true" && <> · <a href="#cronograma-incorporacao">incorporação em rascunho</a></>}
                </p></nav>}
                {selecionado === lote.id && (
                  <div id="cronograma-detalhe"><DetalheCronograma
                    key={JSON.stringify([userId, clienteId, lote.id, lote.revisao])}
                    userId={userId}
                    clienteId={clienteId}
                    loteId={lote.id}
                    revisao={lote.revisao}
                  /></div>
                )}
                {selecionado === lote.id && <div id="cronograma-mapeamento"><MapeamentoLinha userId={userId} clienteId={clienteId} loteId={lote.id} revisao={lote.revisao} /></div>}
                {selecionado === lote.id && import.meta.env.VITE_SSO_REVISAO_LINHA_CRONOGRAMA_ENABLED === "true" && <div id="cronograma-revisao"><RevisaoLinha userId={userId} clienteId={clienteId} loteId={lote.id} revisao={lote.revisao} /></div>}
                {selecionado === lote.id && import.meta.env.VITE_SSO_CLASSIFICACAO_CRONOGRAMA_ENABLED === "true" && <div id="cronograma-classificacao"><ClassificacaoLinha userId={userId} clienteId={clienteId} loteId={lote.id} /></div>}
                {selecionado === lote.id && import.meta.env.VITE_SSO_CONFERENCIA_INTEGRADA_CRONOGRAMA_ENABLED === "true" && <div id="cronograma-conferencia"><ConferenciaIntegrada userId={userId} clienteId={clienteId} loteId={lote.id} /></div>}
                {selecionado === lote.id && import.meta.env.VITE_SSO_APROVAR_CRONOGRAMA_STAGING_ENABLED === "true" && <div id="cronograma-aprovacao"><AprovarLote userId={userId} clienteId={clienteId} loteId={lote.id} /></div>}
                {selecionado === lote.id && import.meta.env.VITE_SSO_INCORPORAR_CRONOGRAMA_ENABLED === "true" && <div id="cronograma-incorporacao"><IncorporarLinha userId={userId} clienteId={clienteId} loteId={lote.id} /></div>}
                {selecionado === lote.id && <AnotacaoLote key={JSON.stringify([lote.id, lote.revisao])}
                  loteId={lote.id} revisao={lote.revisao} bloqueado={!!tentativa || envio.isPending}
                  rascunho={anotacoes[JSON.stringify([lote.id, lote.revisao])] ?? { linha: "", observacao: "" }}
                  anteriores={Object.entries(anotacoes).flatMap(([chave, rascunho]) => {
                    try { const partes: unknown = JSON.parse(chave); return Array.isArray(partes) && partes[0] === lote.id && typeof partes[1] === "number" && partes[1] !== lote.revisao && (rascunho.linha || rascunho.observacao) ? [{ revisao: partes[1], ...rascunho }] : []; }
                    catch { return []; }
                  })}
                  onAlterar={(rascunho) => setAnotacoes((anteriores) => ({ ...anteriores, [JSON.stringify([lote.id, lote.revisao])]: rascunho }))}
                  enviar={enviar} />}
              </li>
            ))}
          </ul>
          {lotes.hasNextPage && (
            <button type="button" onClick={() => void lotes.fetchNextPage()}>
              Mais lotes
            </button>
          )}
        </>
      )}
    </section>
  );
}

function AnotacaoLote({ loteId, revisao, bloqueado, rascunho, anteriores, onAlterar, enviar }: {
  loteId: string; revisao: number; bloqueado: boolean; rascunho: { linha: string; observacao: string };
  anteriores: Array<{ revisao: number; linha: string; observacao: string }>;
  onAlterar: (rascunho: { linha: string; observacao: string }) => void; enviar: (tentativa: Tentativa) => void;
}) {
  const { linha, observacao } = rascunho;
  return <><form onSubmit={(e) => {
    e.preventDefault();
    const numeroLinha = Number(linha);
    if (bloqueado || !/^\d+$/.test(linha) || !Number.isSafeInteger(numeroLinha) || numeroLinha < 1 || !observacao.trim()) return;
    enviar({ tipo: "revisao", pedido: { requestId: crypto.randomUUID(), loteId, expectedRevision: revisao, numeroLinha, observacao: observacao.trim() } });
  }}>
    <label>Número da linha <input required inputMode="numeric" value={linha} onChange={(e) => onAlterar({ ...rascunho, linha: e.target.value })} disabled={bloqueado} /></label>
    <label>Observação <input required maxLength={2000} value={observacao} onChange={(e) => onAlterar({ ...rascunho, observacao: e.target.value })} disabled={bloqueado} /></label>
    <button type="submit" disabled={bloqueado}>Anotar revisão</button>
  </form>{anteriores.length > 0 && <section aria-label="Anotações de revisões anteriores">
    <p>Rascunhos de outras revisões permanecem nesta tela. Confira a linha atual antes de reutilizar; a cópia não envia nem apaga o original.</p>
    <ul>{anteriores.map((anterior) => <li key={anterior.revisao}>Revisão {anterior.revisao} · linha {anterior.linha || "não informada"} · {anterior.observacao || "sem observação"}{" "}
      <button type="button" disabled={bloqueado || !!rascunho.linha || !!rascunho.observacao} onClick={() => onAlterar({ linha: anterior.linha, observacao: anterior.observacao })}>Copiar para revisão atual</button>
    </li>)}</ul>
    {(rascunho.linha || rascunho.observacao) && <p>Para copiar um rascunho anterior, esvazie primeiro os campos da revisão atual.</p>}
  </section>}</>;
}

function DetalheCronograma({
  userId,
  clienteId,
  loteId,
  revisao,
}: { userId: string; clienteId: string; loteId: string; revisao: number }) {
  const [pagina, setPagina] = useState(0);
  const consulta = useQuery({
    queryKey: ["importacao-plano", userId, clienteId, "detalhe", loteId, revisao],
    queryFn: async ({ signal }) => {
      const lote = await obterCronogramaStaging(clienteId, loteId, signal);
      if (lote.revision !== revisao) throw new Error("Revisão mudou; recarregue os lotes.");
      return preverImportacaoPlano({ CRONOGRAMA: lote.matriz }, lote.fonteId, clienteId, [], {});
    },
    gcTime: 0,
  });
  if (consulta.isFetching || consulta.isPending) return <output>Conferindo linhas…</output>;
  if (consulta.isError)
    return (
      <p role="alert">
        Não foi possível conferir linhas.{" "}
        <button type="button" onClick={() => void consulta.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  const tamanhoPagina = 100;
  const totalPaginas = Math.max(1, Math.ceil(consulta.data.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const linhasPagina = consulta.data.slice(paginaAtual * tamanhoPagina, (paginaAtual + 1) * tamanhoPagina);
  return (
    <div>
      <p>Alvos e recorrências ainda não mapeados. Conferência não aprova importação.</p>
      <p>Página {paginaAtual + 1} de {totalPaginas} · {consulta.data.length} linha(s) na matriz consultada.</p>
      <ul>
        {linhasPagina.map(({ original, conferencia }) => (
          <li key={original.numeroLinha}>
            Linha {original.numeroLinha}: {String(original.disciplina)} · código{" "}
            {String(original.codigoOriginal)} · periodicidade{" "}
            {String(original.periodicidadeOriginal)} · pendências{" "}
            {conferencia.erros.join(", ") || "nenhuma sinalizada"}
            <ProgramacaoLinha semanas={conferencia.semanas} />
          </li>
        ))}
      </ul>
      {totalPaginas > 1 && <nav aria-label="Páginas de linhas do cronograma">
        <button type="button" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>Página anterior</button>{" "}
        <button type="button" disabled={paginaAtual >= totalPaginas - 1} onClick={() => setPagina(paginaAtual + 1)}>Próxima página</button>
      </nav>}
    </div>
  );
}
