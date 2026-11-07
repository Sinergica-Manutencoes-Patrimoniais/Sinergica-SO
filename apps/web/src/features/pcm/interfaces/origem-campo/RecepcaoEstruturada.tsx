import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { EntradaLevantamentos } from "../levantamentos/Conectado";

const contextoSchema = z.object({ clienteId: z.string().guid(), osId: z.string().guid(), envelopeId: z.string().guid(),
  taskId: z.string().regex(/^[1-9]\d{0,18}$/), requestId: z.string().guid() }).strict();
export const pedidoEstruturadoSchema = z.object({ confirmado: z.literal(true), contexto: contextoSchema, entrada: z.unknown(), contrato: z.unknown() }).strict();
const pedidoSchema = pedidoEstruturadoSchema;
export type PedidoEstruturado = z.infer<typeof pedidoEstruturadoSchema>;
type Pedido = PedidoEstruturado;
type Props = { userId: string; clienteId: string; osId: string; envelopeId: string; disponivel: boolean };

/** Recepção declarada: não prova que questionário ou fotos vieram do Auvo. */
export function RecepcaoEstruturada(props: Props) {
  if (import.meta.env.VITE_SSO_RECEPCAO_ESTRUTURADA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId, props.envelopeId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId, envelopeId, disponivel }: Props) {
  const chave = `sso-recepcao-estruturada:${JSON.stringify([userId, clienteId, envelopeId])}`;
  const chaveManual = `sso-recepcao-envelope:${JSON.stringify([userId, clienteId, envelopeId])}`;
  const [entrada, setEntrada] = useState("");
  const [contrato, setContrato] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [arquivoRespostas, setArquivoRespostas] = useState<File | null>(null);
  const [arquivoMapa, setArquivoMapa] = useState<File | null>(null);
  const [previa, setPrevia] = useState<{ fotografia: string; linhas: { chave: string; tipo: string; atributos: Record<string, string | number> }[]; fotos: { chaveLinha: string; referencia: string }[] } | null>(null);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [abrirLote, setAbrirLote] = useState(false);
  const trava = useRef(false);
  const travaLeitura = useRef(false);
  const montado = useRef(false);
  const disponivelAtual = useRef(disponivel); disponivelAtual.current = disponivel;
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const texto = sessionStorage.getItem(chave);
      if (!texto) return null;
      const p = pedidoSchema.parse(JSON.parse(texto));
      return p.contexto.clienteId === clienteId && p.contexto.osId === osId && p.contexto.envelopeId === envelopeId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const fotografia = JSON.stringify([userId, clienteId, osId, envelopeId, entrada, contrato]);
  const confirmado = confirmacao === fotografia;
  const fotosPorLinha = useMemo(() => {
    const grupos = new Map<string, string[]>();
    for (const f of previa?.fotos ?? []) {
      const referencias = grupos.get(f.chaveLinha) ?? [];
      referencias.push(f.referencia); grupos.set(f.chaveLinha, referencias);
    }
    return grupos;
  }, [previa]);

  function construirPedido(requestId: string): Pedido {
    const dados: unknown = JSON.parse(entrada);
    const mapa: unknown = JSON.parse(contrato);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error();
    const origem = dados as Record<string, unknown>;
    if (origem.clienteId !== clienteId || origem.osId !== osId || origem.envelopeId !== envelopeId || typeof origem.taskId !== "string") throw new Error();
    const p = pedidoSchema.parse({ confirmado: true, contexto: { clienteId, osId, envelopeId, taskId: origem.taskId, requestId }, entrada: dados, contrato: mapa });
    if (new TextEncoder().encode(JSON.stringify(p)).length > 1_200_000) throw new Error();
    return p;
  }

  async function carregarArquivos() {
    if (!arquivoRespostas || !arquivoMapa || travaLeitura.current || pendente || trava.current || previsualizando || !disponivel) return;
    travaLeitura.current = true; setLendoArquivo(true); setAviso("");
    try {
      if (arquivoRespostas.size > 1_048_576 || arquivoMapa.size > 65_536) throw new Error();
      const [respostas, mapeamento] = await Promise.all([arquivoRespostas.text(), arquivoMapa.text()]);
      if (!montado.current || !disponivelAtual.current) throw new Error("Contexto indisponível.");
      if (new TextEncoder().encode(respostas).length > 1_048_576 || new TextEncoder().encode(mapeamento).length > 65_536) throw new Error();
      JSON.parse(respostas); JSON.parse(mapeamento);
      // Substituição é atômica na interface: erro preserva ambos os campos.
      setEntrada(respostas); setContrato(mapeamento); setPrevia(null); setConfirmacao(null);
      setAviso("Arquivos carregados. Gere a prévia e confira antes de receber.");
    } catch { setAviso("Arquivos inválidos ou acima dos limites. Os dados anteriores foram preservados."); }
    finally { travaLeitura.current = false; setLendoArquivo(false); }
  }

  async function visualizar() {
    if (!disponivel || pendente || trava.current || previsualizando || travaLeitura.current) return;
    const versao = fotografia;
    setPrevisualizando(true); setPrevia(null); setConfirmacao(null); setAviso("");
    try {
      if (sessionStorage.getItem(chave) || sessionStorage.getItem(chaveManual)) throw new Error();
      const p = construirPedido(crypto.randomUUID());
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || !montado.current || !disponivelAtual.current) throw new Error();
      const { data, error } = await supabase.functions.invoke("pcm-receber-levantamento-estruturado", { body: { ...p, acao: "prever" } });
      if (error) throw error;
      const r = z.object({ estado: z.literal("preparado"), origem: z.object({ envelopeId: z.string().guid(), clienteId: z.string().guid(), osId: z.string().guid(), taskId: z.string(), questionarioId: z.string(), versao: z.string() }).strict(),
        linhas: z.array(z.object({ chave: z.string(), tipo: z.string(), atributos: z.record(z.string(), z.union([z.string(), z.number()])) }).strict()).min(1).max(1000),
        fotos: z.array(z.object({ chaveLinha: z.string(), referencia: z.string() }).strict()).max(10000) }).strict().parse(data);
      if (r.origem.envelopeId !== envelopeId || r.origem.clienteId !== clienteId || r.origem.osId !== osId || r.origem.taskId !== p.contexto.taskId) throw new Error();
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || !montado.current || !disponivelAtual.current) throw new Error();
      setPrevia({ fotografia: versao, linhas: r.linhas, fotos: r.fotos });
    } catch { setAviso("Não foi possível gerar a prévia. Confira dados e mapeamento; nenhum lote foi criado."); }
    finally { setPrevisualizando(false); }
  }

  async function enviar(p: Pedido) {
    if (trava.current || !disponivel) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || !montado.current || !disponivelAtual.current || sessionStorage.getItem(chave) !== JSON.stringify(p) || sessionStorage.getItem(chaveManual)) throw new Error();
      const { data, error } = await supabase.functions.invoke("pcm-receber-levantamento-estruturado", { body: p });
      if (error) throw error;
      const recibo = z.object({ estado: z.literal("recebido"), requestId: z.string().guid(), loteId: z.string().guid(),
        origemComprovada: z.literal(false), fotosImportadas: z.literal(false), cadastrosIncorporados: z.literal(false) }).strict().parse(data);
      if (recibo.requestId !== p.contexto.requestId) throw new Error();
      await cache.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"], refetchType: "none" });
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || !montado.current || !disponivelAtual.current || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
      sessionStorage.removeItem(chave); setPendente(null); setEntrada(""); setContrato(""); setConfirmacao(null);
      setLoteId(recibo.loteId); setAbrirLote(false);
      setAviso("Lote recebido para conferência; nenhum cadastro foi incorporado e nenhuma foto foi importada.");
    } catch { setAviso("Resultado não confirmado. Preserve a tentativa e repita somente o mesmo pedido ou consulte suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (!disponivel || !confirmado || pendente || trava.current || previsualizando || travaLeitura.current || previa?.fotografia !== fotografia) return;
    try {
      const p = construirPedido(crypto.randomUUID());
      const texto = JSON.stringify(p);
      if (new TextEncoder().encode(texto).length > 1_200_000 || sessionStorage.getItem(chave) || sessionStorage.getItem(chaveManual)) throw new Error();
      sessionStorage.setItem(chave, texto); setPendente(p); void enviar(p);
    } catch { setAviso("Confira os arquivos JSON, o contexto e as tentativas anteriores. Nada foi enviado."); }
  }
  return <section aria-label="Recepção estruturada declarada">
    <h4>Receber questionário estruturado declarado</h4>
    <p>O mapeamento é declarado pelo operador. A origem Auvo não é comprovada e referências de fotos não importam imagens. Dados da tentativa ficam nesta aba até confirmação.</p>
    {pendente === "invalido" ? <p role="alert">Tentativa local inválida. Consulte suporte.</p> : pendente ?
      <button type="button" disabled={ocupado || !disponivel} onClick={() => void enviar(pendente)}>Repetir mesma recepção</button> :
      <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <fieldset disabled={lendoArquivo || previsualizando || ocupado || !disponivel}>
          <legend>Carregar arquivos estruturados</legend>
          <p>Selecione o JSON das respostas e o JSON do mapeamento. Carregar substitui os campos abaixo, sem enviar ou criar lote.</p>
          <label>Respostas <input type="file" accept="application/json,.json" onChange={(e) => setArquivoRespostas(e.target.files?.[0] ?? null)} /></label>
          <label>Mapeamento <input type="file" accept="application/json,.json" onChange={(e) => setArquivoMapa(e.target.files?.[0] ?? null)} /></label>
          <button type="button" disabled={!arquivoRespostas || !arquivoMapa} onClick={() => void carregarArquivos()}>Carregar arquivos</button>
        </fieldset>
        {lendoArquivo && <output>Lendo arquivos…</output>}
        <label>Respostas estruturadas JSON <textarea disabled={lendoArquivo} value={entrada} onChange={(e) => { setEntrada(e.target.value); setConfirmacao(null); }} /></label>
        <label>Mapeamento de perguntas JSON <textarea disabled={lendoArquivo} value={contrato} onChange={(e) => { setContrato(e.target.value); setConfirmacao(null); }} /></label>
        <button type="button" disabled={!disponivel || previsualizando || ocupado || lendoArquivo} onClick={() => void visualizar()}>Gerar prévia sem receber</button>
        {previsualizando && <output>Preparando prévia…</output>}
        {previa?.fotografia === fotografia && <section aria-label="Prévia de levantamento estruturado">
          <p>{previa.linhas.length} item(ns) e {previa.fotos.length} referência(s); confira antes de receber. A prévia não comprova origem ou imagens.</p>
          <ul>{previa.linhas.map((l) => <li key={l.chave}>{l.chave} · {l.tipo}<ul>{Object.entries(l.atributos).map(([campo, valor]) => <li key={campo}>{campo}: {String(valor)}</li>)}</ul>
            <ul>{(fotosPorLinha.get(l.chave) ?? []).map((referencia) => <li key={referencia}>Referência declarada: {referencia}</li>)}</ul></li>)}</ul>
        </section>}
        <label><input type="checkbox" checked={confirmado} disabled={previa?.fotografia !== fotografia || previsualizando} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi Cliente, OS, envelope, respostas e mapeamento.</label>
        <button type="submit" disabled={!disponivel || !confirmado || ocupado || previsualizando || lendoArquivo || previa?.fotografia !== fotografia}>Receber para conferência</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
    {loteId && import.meta.env.VITE_SSO_LEVANTAMENTOS_ENABLED === "true" && <section>
      <button type="button" aria-expanded={abrirLote} onClick={() => setAbrirLote(!abrirLote)}>{abrirLote ? "Ocultar lote" : "Abrir conferência do lote"}</button>
      {abrirLote && <EntradaLevantamentos habilitado={import.meta.env.VITE_SSO_LEVANTAMENTOS_ENABLED} userId={userId} clienteId={clienteId} loteRecebido={loteId} />}
    </section>}
  </section>;
}
