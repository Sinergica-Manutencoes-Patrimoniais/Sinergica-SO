import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { supabasePlanoManutencaoAdapter } from "../infrastructure/supabase-plano-manutencao-adapter";
import { DecidirVencimento } from "../interfaces/plano-manutencao/DecidirVencimento";
import { FilaPreventivaPcm } from "../interfaces/plano-manutencao/FilaPreventivaPcm";
import { EstadoOcorrenciaVinculada } from "../interfaces/plano-manutencao/EstadoOcorrenciaVinculada";
import { FilaVisitaWorkspace } from "./FilaVisitaWorkspace";
import { AplicarRetiradasFila } from "../interfaces/plano-manutencao/AplicarRetiradasFila";

const tamanhoPagina = 50;
const entrada = z.object({
  ciclo_id: z.string().uuid(),
  preparada_id: z.string().uuid(),
  estado: z.enum(["aguardando", "verificacao", "cancelado"]),
  revisao: z.number().int().positive(),
  vencimento: z.string().date(),
  atualizado_em: z.string().datetime({ offset: true }),
  rotina_id: z.string().uuid().nullable(),
  rotina_nome: z.string().nullable(),
  alvo_tipo: z.enum(["sistema", "componente", "grupo"]).nullable(),
  alvo_id: z.string().uuid().nullable(),
  versao_origem_id: z.string().uuid().nullable(),
  ciclo_indice: z.number().int().nonnegative().safe().nullable(),
}).strict();

async function conferirSessao(userId: string, signal: AbortSignal) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
}

/** O nome atual é referência de cadastro, não fotografia histórica da Rotina. */
function NomeAlvo({ userId, clienteId, tipo, id }: { userId: string; clienteId: string; tipo: "sistema" | "componente" | "grupo"; id: string }) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({
    queryKey: ["fila-preventiva-nome-alvo", userId, clienteId, tipo, id],
    enabled: aberto, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessao(userId, signal);
      const tabela = tipo === "sistema" ? "sistemas" : tipo === "grupo" ? "grupos_quantitativos" : "equipamentos";
      const campoCliente = tipo === "componente" ? "client_id" : "cliente_id";
      const { data, error } = await supabase.schema("pcm").from(tabela).select("id,nome")
        .eq(campoCliente, clienteId).eq("id", id).is("deleted_at", null).abortSignal(signal).maybeSingle();
      if (error) throw error;
      const cadastro = z.object({ id: z.string().uuid(), nome: z.string().min(1).max(200) }).strict().parse(data);
      if (cadastro.id.toLowerCase() !== id.toLowerCase()) throw new Error("Alvo divergente.");
      await conferirSessao(userId, signal);
      return cadastro.nome;
    },
  });
  return <span> <button type="button" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)}>
    {aberto ? "Ocultar nome atual" : "Consultar nome atual"}
  </button>{aberto && <>
    {consulta.isFetching && <span role="status"> Consultando cadastro…</span>}
    {!consulta.isFetching && consulta.isError && <span role="alert"> Nome indisponível ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></span>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <span> Nome atual: {consulta.data} (não é fotografia histórica).</span>}
  </>}</span>;
}

export function FilaPreventivaWorkspace(props: { clienteId: string; userId: string }) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}

function Conteudo({ clienteId, userId }: { clienteId: string; userId: string }) {
  const [planoId, setPlanoId] = useState("");
  const [cicloSelecionado, setCicloSelecionado] = useState<string | null>(null);
  const [cicloGerenciado, setCicloGerenciado] = useState<{ cicloId: string; preparadaId: string } | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | "aguardando" | "verificacao" | "cancelado">("todos");
  const [inicioFiltro, setInicioFiltro] = useState("");
  const [fimFiltro, setFimFiltro] = useState("");
  const cronologica = import.meta.env.VITE_SSO_FILA_PREVENTIVA_CRONOLOGICA_ENABLED === "true";
  const periodoInvalido = !!inicioFiltro && !!fimFiltro && inicioFiltro > fimFiltro;
  const planos = useInfiniteQuery({
    queryKey: ["fila-preventiva-planos", userId, clienteId], gcTime: 0, retry: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(userId, signal);
      const pagina = await supabasePlanoManutencaoAdapter.listarPlanos(clienteId, tamanhoPagina, pageParam, signal);
      if (pagina.length > tamanhoPagina) throw new Error("Página inválida.");
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const plano of pagina) {
        if (plano.clienteId.toLowerCase() !== clienteId.toLowerCase() || plano.id.toLowerCase() <= anterior)
          throw new Error("Página divergente.");
        anterior = plano.id.toLowerCase();
      }
      await conferirSessao(userId, signal);
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === tamanhoPagina ? pagina.at(-1)?.id : undefined,
  });
  const listaPlanos = planos.data?.pages.flat() ?? [];
  const planosConsistentes = listaPlanos.every((p, i) => i === 0 || listaPlanos[i - 1]!.id.toLowerCase() < p.id.toLowerCase());
  const planosVisiveis = !!planos.data && !planos.isFetching && !planos.isError && planosConsistentes;
  const plano = planosVisiveis ? listaPlanos.find((p) => p.id === planoId) : undefined;
  const planoSelecionado = !!plano;
  const fila = useInfiniteQuery({
    queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId, cronologica ? "cronologica" : "identificacao-v3", ...(cronologica ? [estadoFiltro, inicioFiltro, fimFiltro] : [])], gcTime: 0, retry: false,
    enabled: !!planoSelecionado && (!cronologica || !periodoInvalido),
    initialPageParam: null as { id: string; vencimento: string } | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(userId, signal);
      const chamada = cronologica
        ? supabase.schema("pcm").rpc("sso_listar_fila_preventiva_cronologica", { p_cliente_id: clienteId, p_plano_id: planoId,
            p_estado: estadoFiltro === "todos" ? null : estadoFiltro, p_inicio: inicioFiltro || null, p_fim: fimFiltro || null,
            p_apos_vencimento: pageParam?.vencimento ?? null, p_apos_ciclo: pageParam?.id ?? null, p_limite: tamanhoPagina })
        : supabase.schema("pcm").rpc("sso_listar_fila_preventiva_pcm_v3", { p_cliente_id: clienteId, p_plano_id: planoId, p_apos: pageParam?.id ?? null, p_limite: tamanhoPagina });
      const { data, error } = await chamada.abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(entrada).max(tamanhoPagina).parse(data);
      let anterior = pageParam;
      for (const item of pagina) {
        if (anterior && (cronologica ? item.vencimento < anterior.vencimento || (item.vencimento === anterior.vencimento && item.ciclo_id.toLowerCase() <= anterior.id.toLowerCase()) : item.ciclo_id.toLowerCase() <= anterior.id.toLowerCase())) throw new Error("Página divergente.");
        anterior = { id: item.ciclo_id, vencimento: item.vencimento };
      }
      await conferirSessao(userId, signal);
      return pagina;
    },
    getNextPageParam: (pagina) => { const ultima = pagina.at(-1); return pagina.length === tamanhoPagina && ultima ? { id: ultima.ciclo_id, vencimento: ultima.vencimento } : undefined; },
  });
  const itens = fila.data?.pages.flat() ?? [];
  const filaConsistente = itens.every((item, i) => i === 0 || (cronologica ? itens[i - 1]!.vencimento < item.vencimento || (itens[i - 1]!.vencimento === item.vencimento && itens[i - 1]!.ciclo_id.toLowerCase() < item.ciclo_id.toLowerCase()) : itens[i - 1]!.ciclo_id.toLowerCase() < item.ciclo_id.toLowerCase()));
  const filaVisivel = planoSelecionado && !periodoInvalido && !!fila.data && !fila.isFetching && !fila.isError && filaConsistente;
  const itensFiltrados = periodoInvalido ? [] : itens.filter((item) =>
    (estadoFiltro === "todos" || item.estado === estadoFiltro) &&
    (!inicioFiltro || item.vencimento >= inicioFiltro) && (!fimFiltro || item.vencimento <= fimFiltro),
  ).slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.ciclo_id.localeCompare(b.ciclo_id));
  const ciclosVisiveis = new Set(itensFiltrados.map((item) => item.ciclo_id));
  const itensOrdenados = itens.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.ciclo_id.localeCompare(b.ciclo_id));

  return <section className="rounded-lg border border-line bg-surface p-4" aria-label="Fila preventiva local">
    <h2 className="font-semibold text-ink">Fila preventiva local por Plano</h2>
    <p>Consulta parcial de registros incluídos pelo PCM. Não comprova execução, disponibilidade atual da fonte ou criação de OS no Auvo.</p>
    {planos.isFetching && <p role="status">Consultando Planos…</p>}
    {(planos.isError || !planosConsistentes) && <p role="alert">Não foi possível conferir os Planos. <button type="button" onClick={() => void planos.refetch()}>Tentar novamente</button></p>}
    {planosVisiveis && <>
      <label>Plano <select value={planoId} onChange={(event) => { setPlanoId(event.target.value); setCicloSelecionado(null); setCicloGerenciado(null); }}>
        <option value="">Selecione um Plano</option>
        {listaPlanos.map((plano) => <option key={plano.id} value={plano.id}>{plano.nome} · {plano.estado} · {plano.id}</option>)}
      </select></label>
      {planos.hasNextPage && <button type="button" disabled={planos.isFetching} onClick={() => void planos.fetchNextPage()}>Carregar mais Planos</button>}
    </>}
    {planoSelecionado && fila.isFetching && <p role="status">Consultando fila…</p>}
    {planoSelecionado && (fila.isError || !filaConsistente) && <p role="alert">Não foi possível conferir a fila. <button type="button" onClick={() => void fila.refetch()}>Tentar novamente</button></p>}
    {planoSelecionado && <fieldset><legend>{cronologica ? "Filtrar fila" : "Filtrar entradas carregadas"}</legend>
        <label>Estado <select value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value as typeof estadoFiltro)}>
          <option value="todos">Todos</option><option value="aguardando">Aguardando</option><option value="verificacao">Em verificação</option><option value="cancelado">Cancelados</option>
        </select></label>
        <label>Vencimento a partir de <input type="date" value={inicioFiltro} onChange={(event) => setInicioFiltro(event.target.value)} /></label>
        <label>Vencimento até <input type="date" value={fimFiltro} onChange={(event) => setFimFiltro(event.target.value)} /></label>
        <p>{cronologica ? "O filtro de calendário é aplicado na consulta; carregue as próximas páginas para ver mais resultados." : "No calendário, filtro e ordem por vencimento consideram somente as páginas carregadas."} {import.meta.env.VITE_SSO_FILA_VISITA_ENABLED === "true" && "Para Visitas, o filtro é aplicado na consulta."} Não alteram programação ou situação.</p>
      </fieldset>}
      {periodoInvalido && <p role="alert">A data inicial deve ser anterior ou igual à final.</p>}
    {filaVisivel && <>
      {itens.length === 0 && <p>Nenhum registro nesta consulta.</p>}
      {!periodoInvalido && itens.length > 0 && itensFiltrados.length === 0 && <p>Nenhuma entrada carregada corresponde ao filtro.</p>}
      <ul>{itensOrdenados.map((item) => <li key={item.ciclo_id} hidden={!ciclosVisiveis.has(item.ciclo_id)}>
        Vencimento {item.vencimento.split("-").reverse().join("/")} · {item.estado === "aguardando" ? "registro aguardando" : item.estado === "verificacao" ? "conferir: execução desconhecida" : "registro cancelado"} · {item.rotina_nome ? `Rotina de referência: ${item.rotina_nome}` : "Rotina não identificada"} · {item.alvo_tipo && item.alvo_id ? `alvo ${item.alvo_tipo}: ${item.alvo_id}` : "alvo não identificado"} · ciclo {item.ciclo_id} · revisão {item.revisao}
        {item.alvo_tipo && item.alvo_id && <NomeAlvo key={`${item.alvo_tipo}:${item.alvo_id}`} userId={userId} clienteId={clienteId} tipo={item.alvo_tipo} id={item.alvo_id} />}
        {import.meta.env.VITE_SSO_ESTADO_OCORRENCIA_VINCULADA_ENABLED === "true" && <EstadoOcorrenciaVinculada userId={userId} clienteId={clienteId} planoId={planoId} preparadaId={item.preparada_id} />}
        <button type="button" aria-expanded={cicloGerenciado?.cicloId === item.ciclo_id} onClick={() => setCicloGerenciado(cicloGerenciado?.cicloId === item.ciclo_id ? null : { cicloId: item.ciclo_id, preparadaId: item.preparada_id })}>
          {cicloGerenciado?.cicloId === item.ciclo_id ? "Ocultar gestão da entrada" : "Gerenciar entrada"}
        </button>
        {import.meta.env.VITE_SSO_DECISAO_VENCIMENTO_ENABLED === "true" && item.estado !== "cancelado" && item.versao_origem_id && item.rotina_id && item.ciclo_indice !== null && plano && <>
          <button type="button" aria-expanded={cicloSelecionado === item.ciclo_id} onClick={() => setCicloSelecionado(cicloSelecionado === item.ciclo_id ? null : item.ciclo_id)}>
            {cicloSelecionado === item.ciclo_id ? "Ocultar decisão" : "Consultar decisão"}
          </button>
          {cicloSelecionado === item.ciclo_id && <DecidirVencimento userId={userId} clienteId={clienteId} planoId={planoId} revision={plano.revisao}
            versaoId={item.versao_origem_id} rotinaId={item.rotina_id} ciclo={item.ciclo_indice} vencimento={item.vencimento} />}
        </>}
      </li>)}</ul>
      {fila.hasNextPage && <button type="button" disabled={fila.isFetching} onClick={() => void fila.fetchNextPage()}>Carregar mais entradas</button>}
      {fila.hasNextPage && <p>Existem mais páginas; esta não é a lista completa.</p>}
    </>}
    {planoSelecionado && import.meta.env.VITE_SSO_FILA_VISITA_ENABLED === "true" && <FilaVisitaWorkspace userId={userId} clienteId={clienteId} planoId={planoId} estado={estadoFiltro} inicio={inicioFiltro} fim={fimFiltro} />}
    {planoSelecionado && import.meta.env.VITE_SSO_RESOLUCAO_IMPACTO_ENABLED === "true" && <AplicarRetiradasFila userId={userId} clienteId={clienteId} planoId={planoId} />}
    {cicloGerenciado && <div hidden={!planoSelecionado}>{!ciclosVisiveis.has(cicloGerenciado.cicloId) && <p>A gestão aberta permanece disponível mesmo com a entrada fora dos resultados carregados. A ação usa uma consulta independente e atual. <button type="button" onClick={() => setCicloGerenciado(null)}>Fechar gestão</button></p>}<FilaPreventivaPcm userId={userId} clienteId={clienteId} planoId={planoId} preparadaId={cicloGerenciado.preparadaId} /></div>}
  </section>;
}
