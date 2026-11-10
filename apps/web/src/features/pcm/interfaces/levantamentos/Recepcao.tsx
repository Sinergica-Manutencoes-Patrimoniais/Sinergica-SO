import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  type RecepcaoLevantamento,
  criarRegistroRecepcao,
  validarRecepcaoLevantamento,
} from "../../application/recepcao-levantamento";
import { diagnosticarRecepcao } from "../../domain/diagnostico-recepcao-levantamento";

export function Recepcao({
  userId,
  clienteId,
  receber,
  confirmarContexto,
  onRecebido,
  consultarRecibo,
  cancelarRecepcao,
  reservarRecepcao,
}: {
  userId: string;
  clienteId: string;
  receber: (clienteId: string, pedido: RecepcaoLevantamento) => Promise<unknown>;
  confirmarContexto?: () => Promise<void>;
  onRecebido?: (loteId: string) => void;
  consultarRecibo?: (clienteId: string, pedido: RecepcaoLevantamento) => Promise<unknown>;
  cancelarRecepcao?: (clienteId: string, pedido: RecepcaoLevantamento, motivo: string) => Promise<{ estado: "cancelado"; requestId: string } | { estado: "recebido"; requestId: string; resultado: unknown }>;
  reservarRecepcao?: (clienteId: string, pedido: RecepcaoLevantamento) => Promise<string>;
}) {
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: (pedido: RecepcaoLevantamento) => receber(clienteId, pedido),
  });
  const registro = useMemo(() => {
    try {
      return criarRegistroRecepcao(userId, clienteId, window.sessionStorage);
    } catch {
      return null;
    }
  }, [userId, clienteId]);
  const [origem, setOrigem] = useState<"" | "campo" | "auvo" | "planilha">("");
  const [chaveOrigem, setChaveOrigem] = useState("");
  const [chave, setChave] = useState("");
  const [tipo, setTipo] = useState<RecepcaoLevantamento["linhas"][number]["tipo"]>("sistema");
  const [nome, setNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [codigoInformado, setCodigoInformado] = useState("");
  const [referenciaPai, setReferenciaPai] = useState("");
  const [sistemaProvisorio, setSistemaProvisorio] = useState("");
  const [localProvisorio, setLocalProvisorio] = useState("");
  const [classificacao, setClassificacao] = useState("");
  const [linhas, setLinhas] = useState<RecepcaoLevantamento["linhas"]>([]);
  const [editandoChave, setEditandoChave] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const chaveCancelamento = `sso-cancelamento-recepcao:${JSON.stringify([userId, clienteId])}`;
  const cancelamentoSchema = z.object({ requestId: z.string().guid(), motivo: z.string().min(1).max(2000) }).strict();
  const [cancelamento, setCancelamento] = useState<z.infer<typeof cancelamentoSchema> | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chaveCancelamento); return salvo === null ? null : cancelamentoSchema.parse(JSON.parse(salvo)); }
    catch { return "invalido"; }
  });
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [, atualizar] = useState(0);
  const foto = JSON.stringify([userId, clienteId, origem, chaveOrigem, chave, tipo, nome, observacoes, quantidade, codigoInformado, referenciaPai, sistemaProvisorio, localProvisorio, classificacao, linhas, editandoChave]);
  const fotoAtual = useRef(foto); fotoAtual.current = foto;
  const linhaInacabada = Boolean(editandoChave || (linhas.length && (chave.trim() || nome.trim() || observacoes.trim() || quantidade.trim() || codigoInformado.trim() || referenciaPai.trim() || sistemaProvisorio.trim() || localProvisorio.trim() || classificacao.trim())));
  let pendente: RecepcaoLevantamento | null = null;
  const diagnosticos = useMemo(() => diagnosticarRecepcao(linhas), [linhas]);
  let invalido = !registro;
  try {
    if (registro) pendente = registro.pendente();
  } catch {
    invalido = true;
  }
  if (cancelamento === "invalido" || (cancelamento !== null && (!pendente || cancelamento.requestId !== pendente.requestId))) invalido = true;

  async function confirmarRecepcao(pedido: RecepcaoLevantamento, resposta: unknown) {
    if (!registro) throw new Error("Tentativa indisponível.");
    await queryClient.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"] });
    await confirmarContexto?.();
    if (cancelamento && (cancelamento === "invalido" || cancelamento.requestId !== pedido.requestId || sessionStorage.getItem(chaveCancelamento) !== JSON.stringify(cancelamento))) throw new Error("Cancelamento local divergente.");
    if (!registro.concluir(pedido.requestId, pedido)) throw new Error("Tentativa local mudou.");
    if (cancelamento) { sessionStorage.removeItem(chaveCancelamento); setCancelamento(null); }
    atualizar((n) => n + 1);
    setMensagem("Levantamento recebido para conferência. Nenhum cadastro foi incorporado.");
    setLinhas([]);
    if (resposta && typeof resposta === "object" && "aggregateId" in resposta &&
      typeof resposta.aggregateId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resposta.aggregateId)) onRecebido?.(resposta.aggregateId);
  }
  async function enviar(pedido: RecepcaoLevantamento, somenteRecibo = false) {
    if (!registro || trava.current || (cancelamento !== null && !somenteRecibo)) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    setMensagem("");
    try {
      await confirmarContexto?.();
      if (!registro.corresponde(pedido)) throw new Error("Tentativa local divergente.");
      if (somenteRecibo && !consultarRecibo) throw new Error("Consulta indisponível.");
      const resposta = somenteRecibo ? await consultarRecibo!(clienteId, pedido) : await mutacao.mutateAsync(pedido);
      await confirmarRecepcao(pedido, resposta);
    } catch {
      setErro("Recepção não confirmada. Repita o pedido pendente ou procure suporte antes de enviar outro.");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  async function cancelar(pedido: RecepcaoLevantamento) {
    if (!registro || !cancelarRecepcao || trava.current || cancelamento === "invalido") return;
    trava.current = true; setOcupado(true); setErro("");
    let tentativa = cancelamento;
    try {
      await confirmarContexto?.();
      if (!registro.corresponde(pedido)) throw new Error("Tentativa divergente.");
      if (!tentativa) {
        if (!confirmarCancelamento || sessionStorage.getItem(chaveCancelamento) !== null) throw new Error("Confirmação necessária.");
        tentativa = cancelamentoSchema.parse({ requestId: pedido.requestId, motivo: motivoCancelamento.trim() });
        sessionStorage.setItem(chaveCancelamento, JSON.stringify(tentativa));
        setCancelamento(tentativa);
      }
      if (tentativa.requestId !== pedido.requestId || sessionStorage.getItem(chaveCancelamento) !== JSON.stringify(tentativa)) throw new Error("Cancelamento divergente.");
      const resultado = await cancelarRecepcao(clienteId, pedido, tentativa.motivo);
      await confirmarContexto?.();
      if (resultado.requestId !== pedido.requestId || sessionStorage.getItem(chaveCancelamento) !== JSON.stringify(tentativa)) throw new Error("Resposta divergente.");
      if (resultado.estado === "recebido") {
        // A tentativa local de cancelamento recém-criada pode ainda não ter sido renderizada.
        await queryClient.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"] });
        await confirmarContexto?.();
        if (sessionStorage.getItem(chaveCancelamento) !== JSON.stringify(tentativa) || !registro.concluir(pedido.requestId, pedido)) throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chaveCancelamento); setCancelamento(null); atualizar((n) => n + 1); setLinhas([]);
        setMensagem("O levantamento já havia sido recebido para conferência; não foi cancelado.");
        const recibo = resultado.resultado;
        if (recibo && typeof recibo === "object" && "aggregateId" in recibo && typeof recibo.aggregateId === "string") onRecebido?.(recibo.aggregateId);
      } else {
        if (!registro.concluir(pedido.requestId, pedido)) throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chaveCancelamento); setCancelamento(null); atualizar((n) => n + 1);
        setConfirmarCancelamento(false); setMotivoCancelamento("");
        setMensagem("Tentativa cancelada no servidor. Nenhum levantamento foi criado por este pedido.");
      }
    } catch { setErro("Cancelamento não confirmado. Repita a mesma solicitação ou procure suporte; não inicie outra recepção."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function montarLinha(): RecepcaoLevantamento["linhas"][number] {
    const numero = quantidade.trim() ? Number(quantidade) : undefined;
    if (!chave.trim() || !nome.trim() || (numero !== undefined && (!Number.isFinite(numero) || numero < 0))) {
      throw new Error("Linha inválida.");
    }
    return { chave: chave.trim(), tipo, atributos: {
      nome: nome.trim(),
      ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      ...(numero !== undefined ? { quantidade: numero } : {}),
      ...(codigoInformado.trim() ? { codigoInformado: codigoInformado.trim() } : {}),
      ...(referenciaPai.trim() ? { referenciaPai: referenciaPai.trim() } : {}),
      ...(sistemaProvisorio.trim() ? { sistemaProvisorio: sistemaProvisorio.trim() } : {}),
      ...(localProvisorio.trim() ? { localProvisorio: localProvisorio.trim() } : {}),
      ...(classificacao.trim() ? { classificacao: classificacao.trim() } : {}),
    } };
  }
  function adicionarLinha() {
    try {
      const linha = montarLinha();
      if ((!editandoChave && linhas.length >= 1000) || linhas.some((existente) => existente.chave === linha.chave && existente.chave !== editandoChave)) throw new Error("Chave duplicada ou limite excedido.");
      if (editandoChave && !linhas.some((existente) => existente.chave === editandoChave)) throw new Error("Linha não encontrada.");
      const antiga = editandoChave;
      const referenciasAtualizadas = antiga && antiga !== linha.chave
        ? linhas.filter((atual) => atual.chave !== antiga && atual.atributos.referenciaPai === antiga).length : 0;
      setLinhas((atuais) => antiga ? atuais.map((atual) => {
        if (atual.chave === antiga) return linha;
        if (antiga !== linha.chave && atual.atributos.referenciaPai === antiga) {
          return { ...atual, atributos: { ...atual.atributos, referenciaPai: linha.chave } };
        }
        return atual;
      }) : [...atuais, linha]);
      setEditandoChave(null);
      setChave(""); setNome(""); setObservacoes(""); setQuantidade(""); setCodigoInformado("");
      setReferenciaPai(""); setSistemaProvisorio(""); setLocalProvisorio(""); setClassificacao("");
      setErro("");
      setMensagem(referenciasAtualizadas ? `Chave alterada; ${referenciasAtualizadas} referência(s) de pai no lote foram atualizadas. Confira a hierarquia antes de enviar.` : "Linha salva no lote local.");
    } catch { setErro("Confira a linha, o limite do lote e se a chave já foi adicionada."); }
  }
  function editarLinha(linha: RecepcaoLevantamento["linhas"][number]) {
    const a = linha.atributos;
    setEditandoChave(linha.chave); setChave(linha.chave); setTipo(linha.tipo); setNome(a.nome);
    setObservacoes(a.observacoes ?? ""); setQuantidade(a.quantidade === undefined ? "" : String(a.quantidade));
    setCodigoInformado(a.codigoInformado ?? ""); setReferenciaPai(a.referenciaPai ?? "");
    setSistemaProvisorio(a.sistemaProvisorio ?? ""); setLocalProvisorio(a.localProvisorio ?? "");
    setClassificacao(a.classificacao ?? ""); setErro("");
  }
  function cancelarEdicao() {
    setEditandoChave(null); setChave(""); setNome(""); setObservacoes(""); setQuantidade("");
    setCodigoInformado(""); setReferenciaPai(""); setSistemaProvisorio(""); setLocalProvisorio(""); setClassificacao("");
  }
  async function iniciar() {
    if (!registro || trava.current || invalido || cancelamento !== null) return;
    trava.current = true; setOcupado(true); setErro("");
    let pronto: RecepcaoLevantamento | null = null;
    try {
      if (linhaInacabada) {
        throw new Error("Adicione ou limpe a linha em edição antes de receber.");
      }
      const dados = {
        origem: origem || null,
        chaveOrigem,
        linhas: linhas.length ? linhas : [montarLinha()],
      };
      const candidato = validarRecepcaoLevantamento({ ...dados, requestId: crypto.randomUUID() });
      await confirmarContexto?.();
      if (registro.pendente() !== null) throw new Error("Tentativa anterior pendente.");
      const requestId = reservarRecepcao ? await reservarRecepcao(clienteId, candidato) : undefined;
      await confirmarContexto?.();
      if (fotoAtual.current !== foto || registro.pendente() !== null) throw new Error("Dados alterados.");
      const { requestId: _temporario, ...validados } = candidato;
      const pedido = registro.preparar(validados, requestId);
      atualizar((n) => n + 1);
      pronto = pedido;
    } catch {
      setErro("Não foi possível preparar o levantamento. Confira os dados, a sessão e a disponibilidade da reserva.");
    }
    finally { trava.current = false; setOcupado(false); }
    if (pronto) void enviar(pronto);
  }
  return (
    <section>
      <h3>Receber levantamento</h3>
      <p>
        Adicione as linhas antes de receber o lote para conferência. Dados ainda não integram o
        cadastro oficial. Esta tela não importa fotos nem aciona Auvo.
      </p>
      <p>Entrada manual; a origem declarada é opcional e não comprova a origem dos dados.</p>
      {erro && <p role="alert">{erro}</p>}
      {invalido && (
        <p role="alert">Pedido pendente inválido ou armazenamento indisponível; procure suporte.</p>
      )}
      {mensagem && <p>{mensagem}</p>}
      {pendente && (
        <>
          <button type="button" disabled={ocupado || cancelamento !== null} onClick={() => void enviar(pendente)}>
            Repetir recepção pendente
          </button>
          {consultarRecibo && <button type="button" disabled={ocupado} onClick={() => void enviar(pendente, true)}>Consultar recibo sem reenviar</button>}
          {cancelamento === "invalido" && <p role="alert">Cancelamento local ilegível. Consulte suporte.</p>}
          {cancelarRecepcao && cancelamento !== "invalido" && (cancelamento ?
            <button type="button" disabled={ocupado} onClick={() => void cancelar(pendente)}>Consultar ou repetir mesmo cancelamento</button> :
            <fieldset disabled={ocupado}><legend>Cancelar tentativa pendente</legend>
              <p>Se o lote já tiver sido recebido, ele será preservado. Caso contrário, este pedido ficará impedido de ser recebido depois.</p>
              <label>Motivo <textarea maxLength={2000} value={motivoCancelamento} onChange={(e) => { setMotivoCancelamento(e.target.value); setConfirmarCancelamento(false); }} /></label>
              <label><input type="checkbox" checked={confirmarCancelamento} onChange={(e) => setConfirmarCancelamento(e.target.checked)} /> Conferi o pedido e o motivo.</label>
              <button type="button" disabled={!confirmarCancelamento || !motivoCancelamento.trim()} onClick={() => void cancelar(pendente)}>Cancelar tentativa</button>
            </fieldset>)}
        </>
      )}
      <fieldset disabled={ocupado || invalido || Boolean(pendente)}>
        <label>
          Origem declarada
          <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)}>
            <option value="">Não informada</option>
            <option value="campo">Campo</option>
            <option value="auvo">Auvo</option>
            <option value="planilha">Planilha</option>
          </select>
        </label>
        <label>
          Identificação da origem
          <input
            value={chaveOrigem}
            maxLength={200}
            onChange={(e) => setChaveOrigem(e.target.value)}
          />
        </label>
        <label>
          Chave da linha
          <input value={chave} maxLength={200} onChange={(e) => setChave(e.target.value)} />
        </label>
        <label>
          Tipo encontrado
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="area">Área</option>
            <option value="local">Local</option>
            <option value="sublocal">Sublocal</option>
            <option value="sistema">Sistema</option>
            <option value="equipamento">Equipamento</option>
            <option value="componente">Componente</option>
            <option value="grupo_quantitativo">Grupo Quantitativo</option>
          </select>
        </label>
        <label>
          Nome encontrado
          <input value={nome} maxLength={4000} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>Quantidade <input type="number" min="0" step="any" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>
        <label>Código informado <input maxLength={4000} value={codigoInformado} onChange={(e) => setCodigoInformado(e.target.value)} /></label>
        <label>Referência da linha pai <input maxLength={4000} value={referenciaPai} onChange={(e) => setReferenciaPai(e.target.value)} /></label>
        <label>Sistema sugerido <input maxLength={4000} value={sistemaProvisorio} onChange={(e) => setSistemaProvisorio(e.target.value)} /></label>
        <label>Local sugerido <input maxLength={4000} value={localProvisorio} onChange={(e) => setLocalProvisorio(e.target.value)} /></label>
        <label>Classificação sugerida <input maxLength={4000} value={classificacao} onChange={(e) => setClassificacao(e.target.value)} /></label>
        <label>Observações <textarea maxLength={4000} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></label>
        {editandoChave && <p>Editando linha {editandoChave}. Alterações só entram no lote após salvar.</p>}
        <button type="button" disabled={!chave.trim() || !nome.trim() || (!editandoChave && linhas.length >= 1000)} onClick={adicionarLinha}>{editandoChave ? "Salvar linha" : "Adicionar linha ao lote"}</button>
        {linhaInacabada && <button type="button" onClick={cancelarEdicao}>{editandoChave ? "Cancelar edição da linha" : "Limpar linha não adicionada"}</button>}
        {linhas.length > 0 && <div><p>{linhas.length} linha(s) no lote.</p><ul>{linhas.map((linha) => <li key={linha.chave}>
          {linha.chave} · {linha.tipo} · {linha.atributos.nome} <button type="button" disabled={editandoChave !== null} onClick={() => editarLinha(linha)}>Editar linha</button> <button type="button" disabled={editandoChave !== null} onClick={() => setLinhas((atuais) => atuais.filter((atual) => atual.chave !== linha.chave))}>Remover linha</button>
        </li>)}</ul>
          <p>Conferência apenas das linhas deste lote; não verifica cadastros oficiais, códigos ou vínculos externos.</p>
          {diagnosticos.length > 0 && <ul>{diagnosticos.map((aviso) => <li key={`${aviso.chave}:${aviso.codigo}`}>{aviso.chave}: {aviso.mensagem}</li>)}</ul>}
        </div>}
        {linhaInacabada && <p>Salve ou cancele a linha em edição antes de receber o lote.</p>}
        <button
          type="button"
          disabled={linhaInacabada || !chaveOrigem.trim() || (!linhas.length && (!chave.trim() || !nome.trim()))}
          onClick={() => void iniciar()}
        >
          Receber para conferência
        </button>
      </fieldset>
    </section>
  );
}
