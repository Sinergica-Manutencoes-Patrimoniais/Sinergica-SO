import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { EntradaLevantamentos } from "../levantamentos/Conectado";
import { diagnosticarRecepcao } from "../../domain/diagnostico-recepcao-levantamento";
import { RecepcaoEstruturada } from "./RecepcaoEstruturada";

const linha = z.object({
  chave: z.string().trim().min(1).max(200),
  tipo: z.enum(["area", "local", "sublocal", "sistema", "equipamento", "componente", "grupo_quantitativo"]),
  atributos: z.object({
    nome: z.string().trim().min(1).max(4000), observacoes: z.string().max(4000).optional(),
    quantidade: z.number().finite().nonnegative().optional(), codigoInformado: z.string().max(4000).optional(),
    referenciaPai: z.string().max(4000).optional(), sistemaProvisorio: z.string().max(4000).optional(),
    localProvisorio: z.string().max(4000).optional(), classificacao: z.string().max(4000).optional(),
  }).strict(),
}).strict();
const foto = z.object({ chaveLinha: z.string().trim().min(1).max(200), referencia: z.string().min(1).max(200).refine((s) => s === s.trim()) }).strict();
const dados = z.object({ linhas: z.array(linha).min(1).max(1000), fotos: z.array(foto).max(10000) }).strict();
const limiteTexto = 1_400_000;
function verificarLimites(valor: z.infer<typeof dados>) {
  const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
  if (bytes(valor.linhas) > 1_048_576 || bytes(valor.fotos) > 262_144 || valor.linhas.some((item) => bytes(item) > 32_768)) {
    throw new Error("Limite de tamanho excedido.");
  }
}
function serializarDados(valor: z.infer<typeof dados>): string {
  const validado = dados.parse(valor);
  verificarLimites(validado);
  const texto = JSON.stringify(validado);
  if (new TextEncoder().encode(texto).length > limiteTexto) throw new Error("Limite de tamanho excedido.");
  return texto;
}
export const pedidoRecepcaoEnvelope = dados.extend({ requestId: z.string().uuid(), clienteId: z.string().uuid(), osId: z.string().uuid(), envelopeId: z.string().uuid() }).strict();
const pedido = pedidoRecepcaoEnvelope;
type Pedido = z.infer<typeof pedido>;
type Props = { userId: string; clienteId: string; envelopeId: string; osId: string; disponivel: boolean };

export function RecepcaoEnvelope(props: Props) {
  if (import.meta.env.VITE_SSO_RECEPCAO_MANUAL_ENVELOPE_ENABLED !== "true" || !props.osId) return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.envelopeId, props.osId])} {...props} />;
}

function Conteudo({ userId, clienteId, envelopeId, osId, disponivel }: Props) {
  const cache = useQueryClient();
  const chave = `sso-recepcao-envelope:${JSON.stringify([userId, clienteId, envelopeId])}`;
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const leituraArquivo = useRef(false);
  const [chaveLinha, setChaveLinha] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [tipoLinha, setTipoLinha] = useState<z.infer<typeof linha>["tipo"]>("sistema");
  const [nomeLinha, setNomeLinha] = useState("");
  const [quantidadeLinha, setQuantidadeLinha] = useState("");
  const [codigoLinha, setCodigoLinha] = useState("");
  const [paiLinha, setPaiLinha] = useState("");
  const [sistemaLinha, setSistemaLinha] = useState("");
  const [localLinha, setLocalLinha] = useState("");
  const [classificacaoLinha, setClassificacaoLinha] = useState("");
  const [observacaoLinha, setObservacaoLinha] = useState("");
  const [chaveFoto, setChaveFoto] = useState("");
  const [referenciaFoto, setReferenciaFoto] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [loteRecebido, setLoteRecebido] = useState<string | null>(null);
  const [conferenciaAberta, setConferenciaAberta] = useState(false);
  const trava = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const p = pedido.parse(JSON.parse(salvo));
      return p.clienteId === clienteId && p.envelopeId === envelopeId && p.osId === osId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_receber_envelope_campo_mediada", {
        p_ator_id: userId, p_cliente_id: p.clienteId, p_os_id: p.osId, p_envelope_id: p.envelopeId,
        p_request_id: p.requestId, p_linhas: p.linhas, p_fotos: p.fotos,
      });
      if (error) throw error;
      const r = z.object({ requestId: z.string().uuid(), envelopeId: z.string().uuid(), loteId: z.string().uuid(), estado: z.literal("pendente"), origemComprovada: z.literal(false), fotosImportadas: z.literal(false), cadastrosIncorporados: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.envelopeId !== p.envelopeId) throw new Error("Recibo divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return r;
    },
    onSuccess: async (r, p) => {
      try {
        await cache.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"] });
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
        sessionStorage.removeItem(chave);
        setPendente(null); setTexto(""); setConfirmado(false); setLoteRecebido(r.loteId); setConferenciaAberta(false);
        setAviso(`Lote ${r.loteId} recebido para conferência. Nenhum cadastro foi incorporado.`);
      } catch { setAviso("Não foi possível concluir a conferência da sessão ou da tentativa. Consulte o recibo antes de outra recepção."); }
    },
    onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),
    onSettled: () => { trava.current = false; },
  });
  function enviar(p: Pedido) {
    if (trava.current || !disponivel) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); }
    catch { setAviso("Tentativa indisponível ou alterada. Consulte suporte."); return; }
    trava.current = true; envio.mutate(p);
  }
  function iniciar() {
    if (!disponivel || !confirmado || pendente || trava.current || leituraArquivo.current) return;
    if (editando || [chaveLinha, nomeLinha, quantidadeLinha, codigoLinha, paiLinha, sistemaLinha, localLinha, classificacaoLinha, observacaoLinha, chaveFoto, referenciaFoto].some((v) => v.trim())) {
      setAviso("Adicione ou limpe o item ou a referência em edição antes de receber o lote.");
      return;
    }
    try {
      if (sessionStorage.getItem(`sso-recepcao-estruturada:${JSON.stringify([userId, clienteId, envelopeId])}`)) throw new Error();
      if (new TextEncoder().encode(texto).length > limiteTexto) throw new Error();
      const conteudo = dados.parse(JSON.parse(texto));
      verificarLimites(conteudo);
      const chaves = new Set(conteudo.linhas.map((l) => l.chave));
      if (chaves.size !== conteudo.linhas.length || conteudo.fotos.some((f) => !chaves.has(f.chaveLinha))) throw new Error();
      const referencias = conteudo.fotos.map((f) => JSON.stringify([f.chaveLinha, f.referencia]));
      if (new Set(referencias).size !== referencias.length) throw new Error();
      const p = pedido.parse({ ...conteudo, requestId: crypto.randomUUID(), clienteId, osId, envelopeId });
      if (sessionStorage.getItem(chave) !== null) throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
    } catch { setAviso("Confira o formato, as linhas, as referências e o armazenamento da sessão. Nada foi enviado."); }
  }
  function adicionarLinha() {
    try {
      const atual = texto.trim() ? dados.parse(JSON.parse(texto)) : { linhas: [], fotos: [] };
      const quantidade = quantidadeLinha.trim() ? Number(quantidadeLinha) : undefined;
      const nova = linha.parse({ chave: chaveLinha, tipo: tipoLinha, atributos: {
        nome: nomeLinha, ...(quantidade === undefined ? {} : { quantidade }),
        ...(codigoLinha.trim() ? { codigoInformado: codigoLinha.trim() } : {}),
        ...(paiLinha.trim() ? { referenciaPai: paiLinha.trim() } : {}),
        ...(sistemaLinha.trim() ? { sistemaProvisorio: sistemaLinha.trim() } : {}),
        ...(localLinha.trim() ? { localProvisorio: localLinha.trim() } : {}),
        ...(classificacaoLinha.trim() ? { classificacao: classificacaoLinha.trim() } : {}),
        ...(observacaoLinha.trim() ? { observacoes: observacaoLinha.trim() } : {}),
      } });
      if (editando) {
        if (nova.chave !== editando || atual.linhas.filter((item) => item.chave === editando).length !== 1) throw new Error();
        setTexto(serializarDados({ ...atual, linhas: atual.linhas.map((item) => item.chave === editando ? nova : item) }));
      } else {
        if (atual.linhas.some((item) => item.chave === nova.chave) || atual.linhas.length >= 1000) throw new Error();
        setTexto(serializarDados({ ...atual, linhas: [...atual.linhas, nova] }));
      }
      setChaveLinha(""); setNomeLinha(""); setQuantidadeLinha(""); setCodigoLinha(""); setPaiLinha("");
      setSistemaLinha(""); setLocalLinha(""); setClassificacaoLinha(""); setObservacaoLinha(""); setEditando(null); setConfirmado(false); setAviso("");
    } catch { setAviso("Confira chave, nome, quantidade e limites do levantamento; a chave não pode se repetir. O item em edição foi preservado."); }
  }
  function adicionarFoto() {
    try {
      const atual = dados.parse(JSON.parse(texto));
      const nova = foto.parse({ chaveLinha: chaveFoto, referencia: referenciaFoto });
      if (atual.fotos.length >= 10000 || !atual.linhas.some((item) => item.chave === nova.chaveLinha) || atual.fotos.some((item) => item.chaveLinha === nova.chaveLinha && item.referencia === nova.referencia)) throw new Error();
      setTexto(serializarDados({ ...atual, fotos: [...atual.fotos, nova] }));
      setChaveFoto(""); setReferenciaFoto(""); setConfirmado(false); setAviso("");
    } catch { setAviso("Confira a linha, a referência e os limites do levantamento; referências repetidas não são aceitas. Os campos foram preservados."); }
  }
  async function carregarArquivo() {
    if (!arquivo || lendoArquivo || leituraArquivo.current || pendente || editando || trava.current) return;
    if ([chaveLinha, nomeLinha, quantidadeLinha, codigoLinha, paiLinha, sistemaLinha, localLinha, classificacaoLinha, observacaoLinha, chaveFoto, referenciaFoto].some((v) => v.trim())) {
      setAviso("Conclua ou limpe os campos em edição antes de carregar o arquivo.");
      return;
    }
    if (arquivo.size > limiteTexto) { setAviso("Arquivo excede o limite de tamanho do levantamento."); return; }
    leituraArquivo.current = true;
    setLendoArquivo(true);
    try {
      const conteudo = dados.parse(JSON.parse(await arquivo.text()));
      verificarLimites(conteudo);
      const chaves = new Set(conteudo.linhas.map((item) => item.chave));
      const referencias = conteudo.fotos.map((item) => JSON.stringify([item.chaveLinha, item.referencia]));
      if (chaves.size !== conteudo.linhas.length || conteudo.fotos.some((item) => !chaves.has(item.chaveLinha)) || new Set(referencias).size !== referencias.length) throw new Error();
      setTexto(serializarDados(conteudo));
      setConfirmado(false);
      setArquivo(null);
      setAviso("Arquivo carregado para conferência. Nenhum dado foi recebido ou incorporado.");
    } catch { setAviso("Arquivo inválido ou acima dos limites. Os dados anteriores foram preservados."); }
    finally { leituraArquivo.current = false; setLendoArquivo(false); }
  }
  const previa = useMemo(() => {
    try { return texto.trim() ? dados.parse(JSON.parse(texto)) : null; }
    catch { return null; }
  }, [texto]);
  const fotosPorLinha = useMemo(() => {
    const agrupadas = new Map<string, z.infer<typeof foto>[]>();
    for (const referencia of previa?.fotos ?? []) {
      const fotosDaLinha = agrupadas.get(referencia.chaveLinha) ?? [];
      fotosDaLinha.push(referencia);
      agrupadas.set(referencia.chaveLinha, fotosDaLinha);
    }
    return agrupadas;
  }, [previa]);
  const avisosHierarquia = useMemo(() => {
    try { return diagnosticarRecepcao(dados.parse(JSON.parse(texto)).linhas); }
    catch { return []; }
  }, [texto]);
  function editarLinha(item: z.infer<typeof linha>) {
    if (editando || [chaveLinha, nomeLinha, quantidadeLinha, codigoLinha, paiLinha, sistemaLinha, localLinha, classificacaoLinha, observacaoLinha].some((v) => v.trim())) {
      setAviso("Conclua o item em edição antes de selecionar outro."); return;
    }
    setEditando(item.chave); setChaveLinha(item.chave); setTipoLinha(item.tipo); setNomeLinha(item.atributos.nome);
    setQuantidadeLinha(item.atributos.quantidade === undefined ? "" : String(item.atributos.quantidade));
    setCodigoLinha(item.atributos.codigoInformado ?? ""); setPaiLinha(item.atributos.referenciaPai ?? "");
    setSistemaLinha(item.atributos.sistemaProvisorio ?? ""); setLocalLinha(item.atributos.localProvisorio ?? "");
    setClassificacaoLinha(item.atributos.classificacao ?? ""); setObservacaoLinha(item.atributos.observacoes ?? "");
    setConfirmado(false); setAviso("");
  }
  function cancelarEdicao() {
    setEditando(null); setChaveLinha(""); setNomeLinha(""); setQuantidadeLinha(""); setCodigoLinha(""); setPaiLinha("");
    setSistemaLinha(""); setLocalLinha(""); setClassificacaoLinha(""); setObservacaoLinha(""); setConfirmado(false); setAviso("");
  }
  function removerLinha(chaveRemover: string) {
    if (!previa) return;
    if (editando === chaveRemover) { setAviso("Conclua ou cancele a edição antes de remover este item."); return; }
    if (previa.fotos.some((f) => f.chaveLinha === chaveRemover)) { setAviso("Remova primeiro as referências de foto desta linha."); return; }
    const linhas = previa.linhas.filter((l) => l.chave !== chaveRemover);
    setTexto(linhas.length ? JSON.stringify({ ...previa, linhas }, null, 2) : "");
    setConfirmado(false); setAviso("");
  }
  function removerFoto(chaveRemover: string, referencia: string) {
    if (!previa) return;
    setTexto(JSON.stringify({ ...previa, fotos: previa.fotos.filter((f) => f.chaveLinha !== chaveRemover || f.referencia !== referencia) }, null, 2));
    setConfirmado(false); setAviso("");
  }
  return <section aria-label="Recepção manual de levantamento">
    <RecepcaoEstruturada userId={userId} clienteId={clienteId} osId={osId} envelopeId={envelopeId} disponivel={disponivel && !envio.isPending && !pendente} />
    <p>Os dados são declarados manualmente. A origem não é comprovada; referências de fotos não importam imagens. O lote ficará pendente de conferência pelo PCM.</p>
    <p>Uma tentativa pendente e seus dados ficam temporariamente armazenados nesta aba.</p>
    {pendente === "invalido" ? <p role="alert">Tentativa ilegível ou de outra OS. Consulte suporte.</p> : pendente ?
      <button type="button" disabled={envio.isPending || !disponivel} onClick={() => enviar(pendente)}>Repetir recepção</button> :
      <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <fieldset disabled={lendoArquivo}><legend>Carregar levantamento estruturado</legend>
          <p>Arquivo JSON com linhas e referências declaradas. Carregar substitui os dados exibidos, sem enviar ou aprovar o lote.</p>
          <label>Arquivo <input type="file" accept="application/json,.json" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></label>
          <button type="button" disabled={!arquivo || !!editando} onClick={() => void carregarArquivo()}>{texto ? "Substituir dados pelo arquivo" : "Carregar arquivo"}</button>
        </fieldset>
        {lendoArquivo && <output>Lendo arquivo…</output>}
        <fieldset disabled={lendoArquivo}>
        <fieldset><legend>{editando ? "Editar item encontrado" : "Adicionar item encontrado"}</legend>
          <label>Chave da linha <input value={chaveLinha} maxLength={200} readOnly={!!editando} onChange={(e) => setChaveLinha(e.target.value)} /></label>
          <label>Tipo <select value={tipoLinha} onChange={(e) => setTipoLinha(e.target.value as typeof tipoLinha)}>
            <option value="area">Área</option><option value="local">Local</option><option value="sublocal">Sublocal</option><option value="sistema">Sistema</option><option value="equipamento">Equipamento</option><option value="componente">Componente</option><option value="grupo_quantitativo">Grupo Quantitativo</option>
          </select></label>
          <label>Nome <input value={nomeLinha} maxLength={4000} onChange={(e) => setNomeLinha(e.target.value)} /></label>
          <label>Quantidade, quando conhecida <input type="number" min="0" step="any" value={quantidadeLinha} onChange={(e) => setQuantidadeLinha(e.target.value)} /></label>
          <label>Código informado <input maxLength={4000} value={codigoLinha} onChange={(e) => setCodigoLinha(e.target.value)} /></label>
          <label>Referência da linha pai <input maxLength={4000} value={paiLinha} onChange={(e) => setPaiLinha(e.target.value)} /></label>
          <label>Sistema sugerido <input maxLength={4000} value={sistemaLinha} onChange={(e) => setSistemaLinha(e.target.value)} /></label>
          <label>Local sugerido <input maxLength={4000} value={localLinha} onChange={(e) => setLocalLinha(e.target.value)} /></label>
          <label>Classificação sugerida <input maxLength={4000} value={classificacaoLinha} onChange={(e) => setClassificacaoLinha(e.target.value)} /></label>
          <label>Observações <textarea maxLength={4000} value={observacaoLinha} onChange={(e) => setObservacaoLinha(e.target.value)} /></label>
          <button type="button" onClick={adicionarLinha}>{editando ? "Salvar edição" : "Adicionar item"}</button>
          {editando && <button type="button" onClick={cancelarEdicao}>Cancelar edição</button>}
        </fieldset>
        <fieldset><legend>Adicionar referência declarada de foto</legend>
          <label>Item relacionado <select value={chaveFoto} onChange={(e) => setChaveFoto(e.target.value)}>
            <option value="">Selecione um item do levantamento</option>
            {chaveFoto && !previa?.linhas.some((item) => item.chave === chaveFoto) && <option value={chaveFoto}>Item não disponível: {chaveFoto}</option>}
            {previa?.linhas.map((item) => <option key={item.chave} value={item.chave}>{item.chave} · {item.atributos.nome}</option>)}
          </select></label>
          <label>Referência <input value={referenciaFoto} maxLength={200} onChange={(e) => setReferenciaFoto(e.target.value)} /></label>
          <button type="button" disabled={!previa?.linhas.some((item) => item.chave === chaveFoto)} onClick={adicionarFoto}>Adicionar referência</button>
          <p>Selecionar o item não importa a foto nem comprova sua origem.</p>
        </fieldset>
        {previa && <section aria-label="Conferência do levantamento"><h4>Conferir itens e referências</h4>
          <p>{previa.linhas.length} item(ns) e {previa.fotos.length} referência(s) declarada(s). Revise os dados antes de receber.</p>
          {avisosHierarquia.length > 0 && <section aria-label="Avisos de hierarquia e possíveis duplicidades">
            <p>Os avisos verificam apenas este levantamento. Referências ao cadastro oficial e possíveis duplicidades ainda devem ser conferidas pelo PCM; não impedem a recepção.</p>
            <ul>{avisosHierarquia.map((item, indice) => <li key={`${item.chave}:${item.codigo}:${indice}`}>Linha {item.chave}: {item.mensagem}</li>)}</ul>
          </section>}
          <ul>{previa.linhas.map((item) => <li key={item.chave}>{item.chave} · {item.tipo} · {item.atributos.nome}
            {item.atributos.quantidade !== undefined && ` · quantidade ${item.atributos.quantidade}`}
            {Object.entries(item.atributos).filter(([campo]) => campo !== "nome" && campo !== "quantidade").map(([campo, valor]) => <p key={campo}>{campo}: {valor}</p>)}
            <button type="button" onClick={() => editarLinha(item)}>Editar item</button>
            <button type="button" onClick={() => removerLinha(item.chave)}>Remover item</button>
            <ul>{(fotosPorLinha.get(item.chave) ?? []).map((f) => <li key={f.referencia}>{f.referencia} <button type="button" onClick={() => removerFoto(f.chaveLinha, f.referencia)}>Remover referência</button></li>)}</ul>
          </li>)}</ul>
        </section>}
        {texto.trim() && !previa && <p role="alert">Dados estruturados inválidos; corrija antes de receber.</p>}
        <details><summary>Editar dados estruturados</summary><label>Dados estruturados JSON <textarea value={texto} disabled={!!editando} onChange={(e) => { setTexto(e.target.value); setConfirmado(false); }} /></label>
          <p>Objeto com listas <code>linhas</code> e <code>fotos</code>; cada linha exige chave, tipo e atributos com nome.</p></details>
        <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Conferi a OS selecionada e os dados declarados.</label>
        <button type="submit" disabled={!disponivel || !confirmado || envio.isPending}>Receber para conferência</button>
        </fieldset>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
    {loteRecebido && import.meta.env.VITE_SSO_LEVANTAMENTOS_ENABLED === "true" && <section aria-label="Conferência do lote recebido">
      <button type="button" aria-expanded={conferenciaAberta} onClick={() => setConferenciaAberta((aberta) => !aberta)}>{conferenciaAberta ? "Ocultar conferência" : "Abrir conferência do lote"}</button>
      {conferenciaAberta && <EntradaLevantamentos habilitado={import.meta.env.VITE_SSO_LEVANTAMENTOS_ENABLED} userId={userId} clienteId={clienteId} loteRecebido={loteRecebido} />}
    </section>}
  </section>;
}
