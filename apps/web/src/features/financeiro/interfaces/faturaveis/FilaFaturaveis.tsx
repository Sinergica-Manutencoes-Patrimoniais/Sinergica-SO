import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { AlocarDocumento } from "./AlocarDocumento";
import { CorrigirFaturavel } from "./CorrigirFaturavel";
import { ConferirEstornos } from "./ConferirEstornos";
import { HistoricoDocumentos } from "./HistoricoDocumentos";
import { DocumentosCompetencia } from "./DocumentosCompetencia";
import { ReconhecerProposta } from "./ReconhecerProposta";
import { DeclaracoesMaterial } from "./DeclaracoesMaterial";
import { ModoProposta } from "./ModoProposta";
import { CorrigirModoProposta } from "./CorrigirModoProposta";
import { RastreioLinhaMaterial } from "./RastreioLinhaMaterial";
import { HistoricoRevisaoFaturavel } from "./HistoricoRevisaoFaturavel";
import { ComprovantesFaturavel } from "./ComprovantesFaturavel";
import { DocumentoInterno } from "./DocumentoInterno";
import { RecuperarParcela } from "./RecuperarParcela";
import { RelatorioDespesasFaturaveis } from "./RelatorioDespesasFaturaveis";
import { DiagnosticoAceiteComplemento } from "./DiagnosticoAceiteComplemento";
import { DiagnosticoOrigemOs } from "./DiagnosticoOrigemOs";
import { ServicosExtra } from "./ServicosExtra";
import { RastreioCandidatoServico } from "./RastreioCandidatoServico";
import { ConferirServico, possuiTentativaConferenciaServico, RecuperarConferenciasServico } from "./ConferirServico";
import { prepararConferenciaFaturavel } from "../../domain/faturaveis";
import {
  type ComandoFaturavel,
  supabaseFaturaveisAdapter,
  validarComandoFaturavel,
} from "../../infrastructure/supabase-faturaveis-adapter";

type Props = { usuario: string; cliente: string };
/** Fluxo fechado por flag; funções também não têm EXECUTE em papéis da aplicação. */
export function FilaFaturaveis(props: Props) {
  if (import.meta.env.VITE_SSO_FATURAVEIS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente])} {...props} />;
}
function Conteudo({ usuario, cliente }: Props) {
  const chavePedido = `faturavel-decisao:${JSON.stringify([usuario, cliente])}`;
  const cancelamentoHabilitado = import.meta.env.VITE_SSO_CANCELAMENTO_FATURAVEL_ENABLED === "true";
  const [pendente, setPendente] = useState<ComandoFaturavel | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(chavePedido); return raw ? validarComandoFaturavel(JSON.parse(raw)) : null; }
    catch { return "invalido"; }
  });
  const [item, setItem] = useState<{ id: string; revisao: number; valor: number } | null>(null);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const filtroServidor = import.meta.env.VITE_SSO_FILTRO_FATURAVEIS_SERVIDOR_ENABLED === "true";
  const filtroPeriodo = filtroServidor && import.meta.env.VITE_SSO_FILTRO_COMPETENCIA_FATURAVEIS_ENABLED === "true";
  const [competenciaInicio, setCompetenciaInicio] = useState("");
  const [competenciaFim, setCompetenciaFim] = useState("");
  const mesValido = (valor: string) => !valor || /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(valor);
  const periodoValido = mesValido(competenciaInicio) && mesValido(competenciaFim) &&
    (!competenciaInicio || !competenciaFim || competenciaInicio <= competenciaFim);
  const origemNormalizada = filtroOrigem.trim().toLowerCase();
  const origemValida = !origemNormalizada || /^[a-z0-9_]{1,64}$/.test(origemNormalizada);
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const client = useQueryClient();
  const raiz = ["faturaveis", usuario, cliente] as const;
  const consulta = useInfiniteQuery({
    queryKey: [...raiz, filtroServidor ? filtroStatus : null, filtroServidor ? origemNormalizada : null,
      filtroPeriodo ? competenciaInicio : null, filtroPeriodo ? competenciaFim : null],
    enabled: Boolean(usuario && cliente) && (!filtroServidor || origemValida) && (!filtroPeriodo || periodoValido),
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      const pagina = await (filtroPeriodo
        ? supabaseFaturaveisAdapter.listarPeriodo(cliente, filtroStatus === "todos" ? null : filtroStatus, origemNormalizada || null,
          competenciaInicio ? `${competenciaInicio}-01` : null, competenciaFim ? `${competenciaFim}-01` : null, 20, pageParam, signal)
        : filtroServidor
        ? supabaseFaturaveisAdapter.listarFiltrados(cliente, filtroStatus === "todos" ? null : filtroStatus, origemNormalizada || null, 20, pageParam, signal)
        : supabaseFaturaveisAdapter.listar(cliente, 20, pageParam, signal));
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  async function enviar(c: ComandoFaturavel) {
    if (enviando.current || (c.acao === "cancelar" && !cancelamentoHabilitado)) return;
    try {
      if (sessionStorage.getItem(chavePedido) !== JSON.stringify(c)) throw new Error("Pedido divergente");
    } catch {
      setErro("Pedido local mudou ou está indisponível. Procure suporte antes de repetir.");
      return;
    }
    enviando.current = true;
    setOcupado(true);
    setErro("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || sessionStorage.getItem(chavePedido) !== JSON.stringify(c)) throw new Error("Sessão ou pedido alterado.");
      await supabaseFaturaveisAdapter.decidir(c);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      await client.invalidateQueries({ queryKey: raiz });
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      if (sessionStorage.getItem(chavePedido) !== JSON.stringify(c)) {
        setErro("Decisão confirmada, mas o pedido local divergiu. Não o descarte; procure suporte.");
        return;
      }
      sessionStorage.removeItem(chavePedido);
      setPendente(null);
      setItem(null);
    } catch {
      setErro(
        "Não foi possível confirmar. Tente novamente com os mesmos dados e confira a situação antes de fechar.",
      );
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  function iniciar(acao: "conferir" | "cancelar") {
    if (!item || pendente || enviando.current || consulta.isFetching || consulta.isError || paginasDivergentes || (acao === "cancelar" && !cancelamentoHabilitado)) return;
    try {
      if (confirmacao !== JSON.stringify([item.id, item.revisao, item.valor, valor, motivo, acao])) throw new Error("Conferência alterada.");
      if (acao === "conferir" && !valor.trim()) throw new Error("Valor obrigatório.");
      const linhaAtual = consulta.data?.pages.flat().find((linha) => linha.id === item.id);
      if (!linhaAtual || linhaAtual.revisao !== item.revisao || linhaAtual.status !== "pendente" || linhaAtual.valor_original_centavos !== item.valor) {
        throw new Error("Item alterado ou indisponível.");
      }
      if (acao === "conferir" && linhaAtual.origem_tipo === "servico_extra_fato") throw new Error("Conferência de serviço bloqueada.");
      if (acao === "conferir") prepararConferenciaFaturavel(item.valor, Number(valor), motivo);
      const c = validarComandoFaturavel({
        requestId: crypto.randomUUID(),
        itemId: item.id,
        expectedRevision: item.revisao,
        acao,
        valorCentavos: acao === "conferir" ? Number(valor) : null,
        motivo: motivo || null,
      });
      if (sessionStorage.getItem(chavePedido)) throw new Error("Pedido anterior pendente.");
      sessionStorage.setItem(chavePedido, JSON.stringify(c));
      setPendente(c);
      void enviar(c);
    } catch {
      setErro("Confira valor inteiro em centavos e motivo obrigatório.");
    }
  }
  const itensRecebidos = consulta.data?.pages.flat() ?? [];
  const paginasDivergentes = new Set(itensRecebidos.map((linha) => linha.id.toLowerCase())).size !== itensRecebidos.length;
  const itens = consulta.isFetching || consulta.isError || paginasDivergentes ? [] : itensRecebidos;
  const exibidos = itens.filter((linha) => (filtroStatus === "todos" || linha.status === filtroStatus) &&
    (!filtroOrigem.trim() || linha.origem_tipo.toLocaleLowerCase("pt-BR").includes(filtroOrigem.trim().toLocaleLowerCase("pt-BR"))));
  const itemAtual = item && itens.some((linha) => linha.id === item.id && linha.revisao === item.revisao && linha.status === "pendente" && linha.valor_original_centavos === item.valor);
  const servicoBloqueado = !!item && itens.some((linha) => linha.id === item.id && linha.origem_tipo === "servico_extra_fato");
  return (
    <section aria-label="A Faturar">
      <h2>A Faturar</h2>
      {import.meta.env.VITE_SSO_SERVICO_EXTRA_ENABLED === "true" && <ServicosExtra usuario={usuario} cliente={cliente} />}
      {import.meta.env.VITE_SSO_DIAGNOSTICO_ORIGEM_OS_ENABLED === "true" && <DiagnosticoOrigemOs cliente={cliente} />}
      {import.meta.env.VITE_SSO_RELATORIO_DESPESAS_FATURAVEIS_ENABLED === "true" && <RelatorioDespesasFaturaveis usuario={usuario} cliente={cliente} />}
      <ConferirEstornos usuario={usuario} cliente={cliente} />
      <DocumentosCompetencia usuario={usuario} cliente={cliente} />
      <ReconhecerProposta usuario={usuario} cliente={cliente} />
      <ModoProposta usuario={usuario} cliente={cliente} />
      <CorrigirModoProposta usuario={usuario} cliente={cliente} />
      <DeclaracoesMaterial usuario={usuario} cliente={cliente} />
      <p>Conferência não emite documento nem cria cobrança ou recebível.</p>
      <RecuperarConferenciasServico usuario={usuario} cliente={cliente} itensVisiveis={exibidos.map((f) => f.id)} />
      {!consulta.isFetching && !consulta.isError && paginasDivergentes && <p role="alert">A fila mudou durante a consulta. <button type="button" onClick={() => void consulta.refetch()}>Atualizar fila</button></p>}
      {erro && <p role="alert">{erro}</p>}
      {pendente === "invalido" && <p role="alert">Pedido guardado ilegível; procure suporte. Nada foi apagado.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={ocupado || (pendente.acao === "cancelar" && !cancelamentoHabilitado)} onClick={() => void enviar(pendente)}>
          Tentar operação novamente
        </button>
      )}
      {pendente && pendente !== "invalido" && pendente.acao === "cancelar" && !cancelamentoHabilitado && <p>Cancelamento desabilitado; pedido preservado para recuperação.</p>}
      {consulta.isFetching && <output>Consultando itens...</output>}
      {consulta.isError && (
        <p role="alert">
          Não foi possível consultar itens.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && !paginasDivergentes && origemValida && (!filtroPeriodo || periodoValido) && itens.length === 0 && (
        <p>{filtroServidor && (filtroStatus !== "todos" || origemNormalizada || (filtroPeriodo && (competenciaInicio || competenciaFim))) ? "Nenhum item encontrado com estes filtros." : "Nenhum item disponível para este Cliente."}</p>
      )}
      {!consulta.isError && <div>
        <label>{filtroServidor ? "Situação" : "Situação nas páginas carregadas"} <select value={filtroStatus} onChange={(evento) => setFiltroStatus(evento.target.value)}>
          <option value="todos">Todas</option><option value="pendente">Pendente</option><option value="conferido">Conferido</option><option value="parcial">Parcial</option><option value="faturado">Faturado</option><option value="cancelado">Cancelado</option>
        </select></label>
        <label>Tipo de origem <input value={filtroOrigem} onChange={(evento) => setFiltroOrigem(evento.target.value)} /></label>
        {filtroPeriodo && <>
          <label>Competência inicial <input type="month" value={competenciaInicio} onChange={(evento) => setCompetenciaInicio(evento.target.value)} /></label>
          <label>Competência final <input type="month" value={competenciaFim} onChange={(evento) => setCompetenciaFim(evento.target.value)} /></label>
        </>}
        {!consulta.isFetching && !paginasDivergentes && (!filtroServidor || origemValida) && (!filtroPeriodo || periodoValido) && <p>{exibidos.length} de {itens.length} item(ns) nas páginas carregadas{consulta.hasNextPage ? "; carregue mais para ampliar a busca" : ""}. Os totais não representam saldo financeiro.</p>}
      </div>}
      {filtroServidor && !origemValida && <p role="alert">Tipo de origem aceita até 64 letras sem acento, números ou sublinhado.</p>}
      {filtroPeriodo && !periodoValido && <p role="alert">Informe competências válidas; a inicial não pode ser posterior à final.</p>}
      <ul>
        {exibidos.map((f) => (
          <li key={f.id}>
            {f.origem_tipo} · {f.origem_id} · competência {f.competencia} · valor original{" "}
            {f.valor_original_centavos} centavos · {f.status}
            {f.origem_tipo === "servico_extra_fato" && <p>Serviço declarado: a conferência depende da validação da origem. Complemento e faturamento permanecem bloqueados.</p>}
            {f.origem_tipo === "servico_extra_fato" && <RastreioCandidatoServico usuario={usuario} cliente={cliente} itemId={f.id} />}
            {f.origem_tipo === "servico_extra_fato" && (f.status === "pendente" || possuiTentativaConferenciaServico(usuario, cliente, f.id)) && <ConferirServico usuario={usuario} cliente={cliente} itemId={f.id} fatoId={f.origem_id} revision={f.revisao} valorOriginal={f.valor_original_centavos} status={f.status} />}
            {f.origem_tipo === "material_proposta_linha" && <RastreioLinhaMaterial usuario={usuario} cliente={cliente} itemId={f.id} />}
            {(f.origem_tipo === "material_proposta_linha" || import.meta.env.VITE_SSO_HISTORICO_FATURAVEL_TODAS_ORIGENS_ENABLED === "true") && <HistoricoRevisaoFaturavel usuario={usuario} cliente={cliente} itemId={f.id} revisao={f.revisao} />}
            {f.origem_tipo === "despesa_visita" && <ComprovantesFaturavel usuario={usuario} cliente={cliente} itemId={f.id} />}
            {import.meta.env.VITE_SSO_DIAGNOSTICO_ACEITE_COMPLEMENTO_ENABLED === "true" && (f.origem_tipo === "proposta_operacional" || f.origem_tipo === "material_proposta_linha") && <DiagnosticoAceiteComplemento usuario={usuario} cliente={cliente} itemId={f.id} />}
            {f.status === "pendente" && !pendente && (
              <button
                type="button"
                onClick={() => {
                  setItem({ id: f.id, revisao: f.revisao, valor: f.valor_original_centavos });
                  setValor(String(f.valor_original_centavos));
                  setMotivo("");
                  setConfirmacao(null);
                  setErro("");
                }}
              >
                Conferir ou cancelar
              </button>
            )}
            {f.origem_tipo !== "servico_extra_fato" && (f.status === "conferido" || f.status === "parcial") && <AlocarDocumento usuario={usuario} cliente={cliente} itemId={f.id} revisao={f.revisao} />}
            {f.origem_tipo !== "servico_extra_fato" && import.meta.env.VITE_SSO_DOCUMENTO_INTERNO_ENABLED === "true" && (f.status === "conferido" || f.status === "parcial" || f.status === "faturado") && <DocumentoInterno usuario={usuario} cliente={cliente} itemId={f.id} />}
            {f.origem_tipo !== "servico_extra_fato" && import.meta.env.VITE_SSO_RECUPERAR_PARCELA_ENABLED === "true" && <RecuperarParcela usuario={usuario} cliente={cliente} itemId={f.id} />}
            {(f.status === "conferido" || f.status === "parcial" || f.status === "faturado") && <HistoricoDocumentos usuario={usuario} cliente={cliente} itemId={f.id} />}
            {f.origem_tipo !== "servico_extra_fato" && f.status !== "cancelado" && <CorrigirFaturavel usuario={usuario} cliente={cliente} itemId={f.id} revisao={f.revisao} status={f.status} />}
          </li>
        ))}
      </ul>
      {!consulta.isFetching && !consulta.isError && consulta.hasNextPage && (
        <button type="button" onClick={() => void consulta.fetchNextPage()}>
          Carregar mais itens
        </button>
      )}
      {item && !pendente && (
        <section aria-label="Decisão sobre item">
          <p>Item {item.id} · revisão {item.revisao} · original: {item.valor} centavos. Ajustes e cancelamentos exigem motivo.</p>
          {!itemAtual && !consulta.isFetching && <p role="alert">O item selecionado mudou ou não está disponível. Selecione-o novamente antes de continuar.</p>}
          <label>
            Valor conferido em centavos
            <input
              type="number"
              min="0"
              step="1"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label>
            Motivo
            <textarea maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          {!servicoBloqueado && <label><input type="checkbox" disabled={!itemAtual || consulta.isFetching || consulta.isError}
            checked={confirmacao === JSON.stringify([item.id, item.revisao, item.valor, valor, motivo, "conferir"])}
            onChange={(e) => setConfirmacao(e.target.checked ? JSON.stringify([item.id, item.revisao, item.valor, valor, motivo, "conferir"]) : null)} />
            Conferi o item, revisão, valor e motivo para conferência.
          </label>}
          {cancelamentoHabilitado && <label><input type="checkbox" disabled={!itemAtual || consulta.isFetching || consulta.isError}
            checked={confirmacao === JSON.stringify([item.id, item.revisao, item.valor, valor, motivo, "cancelar"])}
            onChange={(e) => setConfirmacao(e.target.checked ? JSON.stringify([item.id, item.revisao, item.valor, valor, motivo, "cancelar"]) : null)} />
            Conferi o item e o motivo para cancelamento.
          </label>}
          <button
            type="button"
            disabled={servicoBloqueado || ocupado || consulta.isFetching || consulta.isError || !itemAtual || confirmacao !== JSON.stringify([item.id, item.revisao, item.valor, valor, motivo, "conferir"])}
            onClick={() => iniciar("conferir")}
          >
            Conferir item
          </button>
          <button
            type="button"
            disabled={!cancelamentoHabilitado || ocupado || consulta.isFetching || consulta.isError || !itemAtual || confirmacao !== JSON.stringify([item.id, item.revisao, item.valor, valor, motivo, "cancelar"])}
            onClick={() => iniciar("cancelar")}
          >
            Cancelar item
          </button>
          {!cancelamentoHabilitado && <p>Cancelamento indisponível nesta interface.</p>}
        </section>
      )}
    </section>
  );
}
