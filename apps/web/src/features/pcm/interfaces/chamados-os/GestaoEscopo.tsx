import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { EncerrarChamadoConferido } from "./EncerrarChamadoConferido";
import { ReabrirChamado } from "./ReabrirChamado";
import { CancelarChamadoConservador } from "./CancelarChamadoConservador";
import { AtribuirParcela } from "../pendencias-tecnicas/AtribuirParcela";
import { AprovarContinuacaoParcela } from "./AprovarContinuacaoParcela";
import { RecuperarContinuacoesParcela } from "./RecuperarContinuacoesParcela";

type Linha = { id: string; descricao?: string; situacao?: string; titulo?: string; status?: string; os_anterior_id?: string; descricao_restante?: string; minutos_restantes?: number };
type Estado = { chamadoId: string; revision: number; composicaoCompleta: boolean; parcelas: Linha[]; continuacoes: Linha[]; ordens: Linha[]; incompleto: boolean };
type Acao = "adicionar_parcela" | "atender_parcela" | "declarar_composicao" | "propor_continuacao" | "revisar_continuacao" | "encerrar" | "aprovar_continuacao";
type Pedido = { requestId: string; criarRequestId: string; clienteId: string; chamadoId: string; revision: number; acao: Acao; itemId: string | null; descricao: string | null; osId: string | null; minutos: number | null; novaOsId: string | null };

async function consultar(cliente: string, chamado: string, signal: AbortSignal): Promise<Estado> {
  const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_escopo_chamado_preparado", { p_cliente_id: cliente, p_chamado_id: chamado }).abortSignal(signal);
  if (error) throw error;
  if (!data || data.chamadoId !== chamado || !Number.isSafeInteger(data.revision) ||
    typeof data.composicaoCompleta !== "boolean" || typeof data.incompleto !== "boolean" ||
    !Array.isArray(data.parcelas) || !Array.isArray(data.continuacoes) || !Array.isArray(data.ordens)) throw new Error("Resposta inválida.");
  return data as Estado;
}

async function enviar(p: Pedido) {
  if (p.acao === "encerrar") throw new Error("Pedido legado de encerramento bloqueado; procure suporte.");
  const chamada = p.acao === "aprovar_continuacao"
    ? supabase.schema("pcm").rpc("sso_aprovar_continuacao_chamado", { p_request_id: p.requestId,
      p_request_criar_id: p.criarRequestId, p_cliente_id: p.clienteId, p_chamado_id: p.chamadoId,
      p_expected_revision: p.revision, p_proposta_id: p.itemId, p_nova_os_id: p.novaOsId })
    : p.acao === "revisar_continuacao" ? supabase.schema("pcm").rpc("sso_revisar_continuacao_chamado", {
      p_request_id: p.requestId, p_cliente_id: p.clienteId, p_chamado_id: p.chamadoId,
      p_expected_revision: p.revision, p_proposta_id: p.itemId, p_descricao: p.descricao, p_minutos: p.minutos,
    }) : supabase.schema("pcm").rpc("sso_comando_escopo_chamado", { p_request_id: p.requestId,
      p_cliente_id: p.clienteId, p_chamado_id: p.chamadoId, p_expected_revision: p.revision,
      p_acao: p.acao, p_item_id: p.itemId, p_descricao: p.descricao, p_os_id: p.osId, p_minutos: p.minutos });
  const { data, error } = await chamada;
  if (error) throw error;
  if (!data || data.requestId !== p.requestId || !Number.isSafeInteger(data.revision)) throw new Error("Resposta inválida.");
}

export function GestaoEscopo({ usuario, cliente, chamado, chamadoEsperado }: { usuario: string; cliente: string; chamado: string; chamadoEsperado: string }) {
  if (import.meta.env.VITE_SSO_GESTAO_ESCOPO_CHAMADO_ENABLED !== "true" || chamado !== chamadoEsperado) return null;
  return <Conteudo key={JSON.stringify([usuario, cliente, chamado])} usuario={usuario} cliente={cliente} chamado={chamado} />;
}

function Conteudo({ usuario, cliente, chamado }: { usuario: string; cliente: string; chamado: string }) {
  const chave = `sso-escopo-chamado:${JSON.stringify([usuario,cliente,chamado])}`;
  const cache = useQueryClient();
  const trava = useRef(false);
  const [acao, setAcao] = useState<Acao>("adicionar_parcela");
  const [item, setItem] = useState("");
  const [os, setOs] = useState("");
  const [descricao, setDescricao] = useState("");
  const [minutos, setMinutos] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = JSON.parse(salvo) as Pedido;
      if (p && p.clienteId === cliente && p.chamadoId === chamado && typeof p.requestId === "string" &&
        typeof p.criarRequestId === "string" && Number.isSafeInteger(p.revision) &&
        ["adicionar_parcela","atender_parcela","declarar_composicao","propor_continuacao","revisar_continuacao","encerrar","aprovar_continuacao"].includes(p.acao)) return p;
      return "invalido";
    } catch { return "invalido"; }
  });
  const conferirSessao = async () => { const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== usuario) throw new Error("Sessão alterada."); };
  const consulta = useQuery({ queryKey: ["gestao-escopo-chamado",usuario,cliente,chamado],
    queryFn: async ({ signal }) => { await conferirSessao(); signal.throwIfAborted(); const resultado = await consultar(cliente,chamado,signal); await conferirSessao(); signal.throwIfAborted(); return resultado; }, gcTime: 0, refetchOnWindowFocus: true });
  const operacao = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao();
    if (sessionStorage.getItem(chave) !== JSON.stringify(p) || p.clienteId !== cliente || p.chamadoId !== chamado) throw new Error("Tentativa alterada.");
    await enviar(p);
    await conferirSessao();
  }, onSuccess: async (_resultado, p) => {
    await cache.invalidateQueries({ queryKey: ["gestao-escopo-chamado",usuario,cliente,chamado] });
    await cache.invalidateQueries({ queryKey: ["chamado-escopo-avaliacao",usuario,cliente,chamado] });
    try { await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) { setMensagem("Operação concluída, mas tentativa local alterada. Reabra para conferir."); return; } sessionStorage.removeItem(chave); } catch { setMensagem("Operação concluída, mas tentativa não foi removida. Procure suporte."); return; }
    setPedido(null); setMensagem("Comando registrado; confira o estado atualizado.");
  }, onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte antes de novo comando."), onSettled: () => { trava.current = false; } });
  const enviarGuardado = (p: Pedido) => {
    if (trava.current) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) { setMensagem("Tentativa local alterada. Reabra para conferir."); return; } }
    catch { setMensagem("Não foi possível conferir tentativa; nada foi enviado."); return; }
    trava.current = true; operacao.mutate(p);
  };
  const estado = consulta.data;
  return <section aria-label="Gestão de escopo e continuidade do Chamado">
    <h3>Escopo e continuidade</h3>
    <p>Revise escopo integral e OS antes de declarar composição ou encerrar. Esta tela não comprova cobertura nem confirma aptidão.</p>
    {import.meta.env.VITE_SSO_CONTINUACAO_PARCELA_CONFERIDA_ENABLED === "true" && <RecuperarContinuacoesParcela usuario={usuario} cliente={cliente} chamado={chamado} />}
    {consulta.isFetching && <output>Carregando escopo…</output>}
    {consulta.isError && <p role="alert">Não foi possível carregar escopo. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {estado?.incompleto && <p role="alert">Lista incompleta: mais de 100 itens. Ações bloqueadas para conferência.</p>}
    {estado && !consulta.isFetching && !consulta.isError && <>
      <p>Revisão {estado.revision}; composição {estado.composicaoCompleta ? "declarada completa" : "não declarada completa"}.</p>
      <ul>{estado.parcelas.map((p) => <li key={p.id}>{p.descricao} · {p.situacao}
        {p.situacao === "pendente" && import.meta.env.VITE_SSO_ATRIBUICAO_PARCELA_ESCOPO_ENABLED === "true" && <details>
          <summary>Atribuir parcela vinculada ao Backlog</summary>
          <p>Disponível apenas para parcelas com vínculo de Backlog; a atribuição não comprova execução.</p>
          <AtribuirParcela userId={usuario} clienteId={cliente} parcelaId={p.id} />
        </details>}
        {p.situacao === "pendente" && import.meta.env.VITE_SSO_ATRIBUICAO_DIRETA_ENABLED === "true" && <details>
          <summary>Atribuir parcela direta à OS</summary>
          <p>Somente parcela sem vínculo ou ciclo de Backlog. A atribuição não comprova execução.</p>
          <AtribuirParcela userId={usuario} clienteId={cliente} parcelaId={p.id} chamadoDiretoId={chamado} />
        </details>}
      </li>)}</ul>
      <ul>{estado.continuacoes.map((p) => <li key={p.id}>{p.descricao_restante} · {p.minutos_restantes} min · {p.situacao}
        {p.situacao==="pendente"&&import.meta.env.VITE_SSO_CONTINUACAO_PARCELA_CONFERIDA_ENABLED==="true"&&<details><summary>Conferir continuidade da parcela</summary><AprovarContinuacaoParcela usuario={usuario} cliente={cliente} chamado={chamado} proposta={p.id} /></details>}</li>)}</ul>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (pedido || trava.current || estado.incompleto || consulta.isFetching || consulta.isError || (acao === "aprovar_continuacao" && import.meta.env.VITE_SSO_CONTINUACAO_PARCELA_CONFERIDA_ENABLED === "true")) return;
        const precisaItem = acao === "atender_parcela" || acao === "aprovar_continuacao" || acao === "revisar_continuacao";
        const precisaOs = acao === "atender_parcela" || acao === "propor_continuacao";
        const precisaDescricao = acao === "adicionar_parcela" || acao === "propor_continuacao" || acao === "revisar_continuacao";
        const tempo = Number(minutos);
        if ((precisaItem && !item) || (precisaOs && !os) || (precisaDescricao && !descricao.trim()) ||
          ((acao === "propor_continuacao" || acao === "revisar_continuacao") && (!Number.isSafeInteger(tempo) || tempo < 1))) { setMensagem("Confira os campos necessários."); return; }
        const p: Pedido = { requestId: crypto.randomUUID(), criarRequestId: crypto.randomUUID(), clienteId: cliente,
          chamadoId: chamado, revision: estado.revision, acao,
          itemId: precisaItem ? item : precisaDescricao ? crypto.randomUUID() : null,
          descricao: precisaDescricao ? descricao.trim() : null, osId: precisaOs ? os : null,
          minutos: acao === "propor_continuacao" || acao === "revisar_continuacao" ? tempo : null, novaOsId: acao === "aprovar_continuacao" ? crypto.randomUUID() : null };
        try { if (sessionStorage.getItem(chave) !== null) { setMensagem("Pedido anterior na sessão; reabra para recuperar."); return; } sessionStorage.setItem(chave,JSON.stringify(p)); }
        catch { setMensagem("Não foi possível guardar tentativa; nada foi enviado."); return; }
        setPedido(p); enviarGuardado(p);
      }}>
        <fieldset disabled={!!pedido || operacao.isPending || estado.incompleto}>
          <label>Ação <select value={acao} onChange={(e) => { setAcao(e.target.value as Acao); setItem(""); setOs(""); }}>
            <option value="adicionar_parcela">Adicionar parcela</option><option value="atender_parcela">Associar parcela a OS finalizada</option>
            <option value="declarar_composicao">Declarar composição completa</option><option value="propor_continuacao">Sugerir continuidade</option>
            <option value="revisar_continuacao">Revisar sugestão</option>
            {import.meta.env.VITE_SSO_CONTINUACAO_PARCELA_CONFERIDA_ENABLED !== "true" && <option value="aprovar_continuacao">Aceitar sugestão de continuidade</option>}
          </select></label>
          {(acao === "atender_parcela" || acao === "aprovar_continuacao" || acao === "revisar_continuacao") && <label>{acao === "atender_parcela" ? "Parcela" : "Sugestão"}<select required value={item} onChange={(e) => { setItem(e.target.value); if (acao === "revisar_continuacao") { const proposta = estado.continuacoes.find((p) => p.id === e.target.value); setDescricao(proposta?.descricao_restante ?? ""); setMinutos(proposta?.minutos_restantes == null ? "" : String(proposta.minutos_restantes)); } }}>
            <option value="">Selecione</option>{(acao === "atender_parcela" ? estado.parcelas : estado.continuacoes).filter((p) => p.situacao === "pendente").map((p) => <option key={p.id} value={p.id}>{p.descricao ?? p.descricao_restante}</option>)}
          </select></label>}
          {(acao === "atender_parcela" || acao === "propor_continuacao") && <label>OS <select required value={os} onChange={(e) => setOs(e.target.value)}>
            <option value="">Selecione</option>{estado.ordens.filter((o) => acao !== "atender_parcela" || o.status === "finalizado").map((o) => <option key={o.id} value={o.id}>{o.titulo} · {o.status}</option>)}
          </select></label>}
          {(acao === "adicionar_parcela" || acao === "propor_continuacao" || acao === "revisar_continuacao") && <label>Descrição <textarea required maxLength={acao === "adicionar_parcela" ? 1000 : 4000} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>}
          {(acao === "propor_continuacao" || acao === "revisar_continuacao") && <label>Minutos restantes <input required type="number" min="1" value={minutos} onChange={(e) => setMinutos(e.target.value)} /></label>}
          {acao === "aprovar_continuacao" && <p>Aceita a descrição e os minutos atuais da sugestão. Nova OS permanece sujeita aos bloqueios de criação.</p>}
          <button type="submit">Confirmar ação</button>
        </fieldset>
      </form>
      {import.meta.env.VITE_SSO_ENCERRAR_CHAMADO_CONFERIDO_ENABLED === "true" && <EncerrarChamadoConferido usuario={usuario} cliente={cliente} chamado={chamado} revision={estado.revision} incompleto={estado.incompleto} />}
      {import.meta.env.VITE_SSO_REABRIR_CHAMADO_ENABLED === "true" && <ReabrirChamado usuario={usuario} cliente={cliente} chamado={chamado} />}
      {import.meta.env.VITE_SSO_CANCELAR_CHAMADO_CONSERVADOR_ENABLED === "true" && <CancelarChamadoConservador usuario={usuario} cliente={cliente} chamado={chamado} revision={estado.revision} incompleto={estado.incompleto} />}
    </>}
    {pedido === "invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    {pedido && pedido !== "invalido" && pedido.acao !== "encerrar" && <button type="button" disabled={operacao.isPending} onClick={() => enviarGuardado(pedido)}>Repetir mesmo pedido</button>}
    {pedido && pedido !== "invalido" && pedido.acao === "encerrar" && <p role="alert">Tentativa antiga de encerramento bloqueada; procure suporte para reconciliar o resultado antes de continuar.</p>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
