import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import {
  type DespesaVisitaListada,
  type RealizarDespesa as Pedido,
  realizarDespesa,
  enviarComprovanteDespesa,
  ingerirComprovanteDespesa,
  validarRealizarDespesa,
} from "../../infrastructure/supabase-despesas-visita-adapter";

type Props = { userId: string; clienteId: string; visitaId: string; despesa: DespesaVisitaListada };
const uploadSchema = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), visitaId: z.string().uuid(), despesaId: z.string().uuid(), expectedRevision: z.number().int().positive(), realizadoCentavos: z.number().int().nonnegative().safe(), caminho: z.string(), hash: z.string().regex(/^[0-9a-f]{64}$/), tipo: z.enum(["application/pdf", "image/jpeg", "image/png"]), tamanho: z.number().int().positive().max(10 * 1024 * 1024), modo: z.literal("mediado").optional() }).strict();
type Upload = z.infer<typeof uploadSchema>;
async function hashArquivo(arquivo: File) {
  const hash = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function RealizarDespesa(props: Props) {
  if (import.meta.env.VITE_SSO_REALIZAR_DESPESAS_VISITA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesa.id])} {...props} />;
}

function Conteudo({ userId, clienteId, visitaId, despesa }: Props) {
  const mediadoHabilitado = import.meta.env.VITE_SSO_INGESTAO_COMPROVANTE_ENABLED === "true";
  const queryClient = useQueryClient();
  const chave = `sso-realizacao-despesa:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const chaveUpload = `sso-upload-despesa:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const chaveModo = `sso-realizacao-despesa-modo:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const trava = useRef(false);
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [fotoConfirmada, setFotoConfirmada] = useState<string | null>(null);
  const foto = JSON.stringify([userId, clienteId, visitaId, despesa.id, despesa.status, despesa.revisao, despesa.realizadoCentavos,
    valor, arquivo && [arquivo.name, arquivo.size, arquivo.type, arquivo.lastModified]]);
  const fotoAtual = useRef(foto); fotoAtual.current = foto;
  const confirmado = fotoConfirmada === foto;
  const [upload, setUpload] = useState<Upload | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chaveUpload); if (!salvo) return null; const p = uploadSchema.parse(JSON.parse(salvo));
      const prefixo = `${clienteId}/${despesa.id}/`;
      return p.clienteId === clienteId && p.visitaId === visitaId && p.despesaId === despesa.id && p.caminho.startsWith(prefixo) && z.string().uuid().safeParse(p.caminho.slice(prefixo.length)).success ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const pedido = validarRealizarDespesa(JSON.parse(salvo));
      return pedido.despesaId === despesa.id && pedido.visitaId === visitaId ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const [mensagem, setMensagem] = useState("");
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const valorExibido = upload && upload !== "invalido" ? upload.realizadoCentavos : /^\d+$/.test(valor) ? Number(valor) : null;
  const valorValido = valorExibido !== null && Number.isSafeInteger(valorExibido) && valorExibido >= 0;
  const consultaConfirmacao = useMutation({
    mutationFn: async (pedido: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_realizacao_despesa", {
        p_ator_id: userId, p_cliente_id: clienteId, p_visita_id: visitaId, p_despesa_id: pedido.despesaId,
        p_request_id: pedido.requestId, p_revision: pedido.expectedRevision, p_valor: pedido.realizadoCentavos, p_objeto_id: pedido.comprovanteObjetoId,
      });
      if (error) throw error;
      const r = z.object({requestId:z.string().uuid(),clienteId:z.string().uuid(),visitaId:z.string().uuid(),despesaId:z.string().uuid(),revision:z.number().int().positive(),confirmada:z.literal(true),integridadeBytesComprovada:z.literal(false)}).strict().parse(data);
      if (r.requestId !== pedido.requestId || r.clienteId !== clienteId || r.visitaId !== visitaId || r.despesaId !== pedido.despesaId || r.revision !== pedido.expectedRevision + 1) throw new Error("Recibo divergente.");
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    },
    onSuccess: async (_r, pedido) => {
      try {
        await queryClient.invalidateQueries({queryKey:["despesas-visita",userId,clienteId,visitaId],refetchType:"none"});
        const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error();
        const salvo = sessionStorage.getItem(chaveUpload);
        if (salvo !== null) { const u=uploadSchema.parse(JSON.parse(salvo)); if (u.requestId!==pedido.requestId||u.clienteId!==clienteId||u.visitaId!==visitaId||u.despesaId!==pedido.despesaId) throw new Error(); }
        const modoSalvo = sessionStorage.getItem(chaveModo);
        if (modoSalvo !== null) { const m=z.object({requestId:z.string().uuid(),modo:z.enum(["mediado","legado"])}).strict().parse(JSON.parse(modoSalvo)); if(m.requestId!==pedido.requestId)throw new Error(); }
        if (sessionStorage.getItem(chaveUpload) !== salvo || sessionStorage.getItem(chaveModo) !== modoSalvo) throw new Error();
        if (salvo !== null) sessionStorage.removeItem(chaveUpload);
        if (modoSalvo !== null) sessionStorage.removeItem(chaveModo);
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error();
        sessionStorage.removeItem(chave); setPendente(null); setUpload(null); setMensagem("Realização confirmada. A consulta não verifica a integridade dos bytes do comprovante.");
        void queryClient.refetchQueries({queryKey:["despesas-visita",userId,clienteId,visitaId],type:"active"});
      } catch { setMensagem("Confirmação encontrada, mas os dados locais mudaram ou não puderam ser limpos. Contate suporte."); }
    },
    onError: () => setMensagem("Confirmação indisponível. A tentativa foi preservada; consulte suporte."),
    onSettled: () => { trava.current = false; },
  });
  const enviar = useMutation({
    mutationFn: async (pedido: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const salvo = sessionStorage.getItem(chaveUpload);
      const tentativa = salvo ? uploadSchema.parse(JSON.parse(salvo)) : null;
      if (tentativa && (tentativa.requestId !== pedido.requestId || tentativa.despesaId !== pedido.despesaId || tentativa.clienteId !== clienteId || tentativa.visitaId !== visitaId)) throw new Error("Tentativa divergente.");
      const modoSalvo = sessionStorage.getItem(chaveModo);
      const modo = modoSalvo ? z.object({ requestId: z.string().uuid(), modo: z.enum(["mediado", "legado"]) }).strict().parse(JSON.parse(modoSalvo)) : null;
      // Sem protocolo preservado não é seguro decidir por inferência como repetir o comando.
      if (!modo || modo.requestId !== pedido.requestId || (tentativa && (tentativa.modo === "mediado" ? "mediado" : "legado") !== modo.modo)) throw new Error("Protocolo da tentativa indisponível ou divergente.");
      const mediado = modo.modo === "mediado";
      if (mediado && !mediadoHabilitado) throw new Error("Ingestão mediada desabilitada.");
      const resultado = await realizarDespesa(pedido, mediado ? "mediado" : "legado");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return resultado;
    },
    onSuccess: async (_resultado, pedido) => {
      try {
        await queryClient.invalidateQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], refetchType: "none" });
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) { setMensagem("Realização registrada, mas a tentativa local divergiu. Contate suporte."); return; }
        const modoSalvo = sessionStorage.getItem(chaveModo);
        const modo = modoSalvo ? z.object({ requestId: z.string().uuid(), modo: z.enum(["mediado", "legado"]) }).strict().parse(JSON.parse(modoSalvo)) : null;
        if (!modo || modo.requestId !== pedido.requestId) { setMensagem("Realização registrada, mas o protocolo local divergiu. Contate suporte."); return; }
        const uploadSalvo = sessionStorage.getItem(chaveUpload);
        if (uploadSalvo !== null) {
          const anterior = uploadSchema.parse(JSON.parse(uploadSalvo));
          if (anterior.requestId !== pedido.requestId || anterior.clienteId !== clienteId || anterior.visitaId !== visitaId || anterior.despesaId !== despesa.id) { setMensagem("Realização registrada, mas o upload local divergiu. Contate suporte."); return; }
        }
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido) || sessionStorage.getItem(chaveUpload) !== uploadSalvo) throw new Error("Tentativa alterada.");
        if (sessionStorage.getItem(chaveModo) !== modoSalvo) { setMensagem("Realização registrada, mas o protocolo local mudou. Contate suporte."); return; }
        if (uploadSalvo !== null) { sessionStorage.removeItem(chaveUpload); setUpload(null); }
        sessionStorage.removeItem(chaveModo);
        sessionStorage.removeItem(chave);
      }
      catch { setMensagem("Realização registrada, mas tentativa local não pôde ser removida. Contate suporte."); return; }
      setPendente(null);
      setMensagem("Realização registrada.");
      void queryClient.refetchQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], type: "active" });
    },
    onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa; consulte suporte antes de sair desta tela."),
    onSettled: () => { trava.current = false; },
  });
  async function iniciar() {
    if (despesa.status !== "ativa" || despesa.realizadoCentavos !== null || pendente || upload === "invalido" || enviar.isPending || consultaConfirmacao.isPending || trava.current || (!upload && (!arquivo || !confirmado))) return;
    trava.current = true;
    setEnviandoArquivo(true);
    let aguardandoComando = false;
    let tentativa = upload;
    try {
      if (tentativa && (tentativa.modo !== "mediado" || !mediadoHabilitado)) throw new Error("Integridade do upload anterior não verificável.");
      if (!tentativa) {
        if (!arquivo || arquivo.size <= 0 || arquivo.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(arquivo.type) || !/^\d{1,16}$/.test(valor)) throw new Error("Arquivo ou valor inválido.");
        const requestId = crypto.randomUUID();
        tentativa = uploadSchema.parse({ requestId, clienteId, visitaId, despesaId: despesa.id, expectedRevision: despesa.revisao, realizadoCentavos: Number(valor), caminho: `${clienteId}/${despesa.id}/${mediadoHabilitado ? requestId : crypto.randomUUID()}`, hash: await hashArquivo(arquivo), tipo: arquivo.type, tamanho: arquivo.size, ...(mediadoHabilitado ? { modo: "mediado" } : {}) });
        if (fotoAtual.current !== foto || sessionStorage.getItem(chaveUpload) !== null || sessionStorage.getItem(chave) !== null || sessionStorage.getItem(chaveModo) !== null) throw new Error("Dados alterados ou tentativa anterior pendente.");
        sessionStorage.setItem(chaveUpload, JSON.stringify(tentativa)); setUpload(tentativa);
      }
      if (!arquivo) throw new Error("Arquivo ausente.");
      if (arquivo.size !== tentativa.tamanho || arquivo.type !== tentativa.tipo || await hashArquivo(arquivo) !== tentativa.hash) throw new Error("Arquivo diferente da tentativa anterior.");
      if (sessionStorage.getItem(chaveUpload) !== JSON.stringify(tentativa)) throw new Error("Tentativa alterada.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const comprovanteObjetoId = tentativa.modo === "mediado" ? await ingerirComprovanteDespesa(tentativa.requestId, despesa.id, arquivo) : await enviarComprovanteDespesa(tentativa.caminho, arquivo, true);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || !montado.current || sessionStorage.getItem(chaveUpload) !== JSON.stringify(tentativa)) throw new Error("Sessão, contexto ou tentativa alterada.");
      const resultado = validarRealizarDespesa({
        requestId: tentativa.requestId, despesaId: despesa.id, visitaId,
        expectedRevision: tentativa.expectedRevision,
        realizadoCentavos: tentativa.realizadoCentavos,
        comprovanteObjetoId,
      });
      const salvo = sessionStorage.getItem(chave);
      if (salvo !== null && salvo !== JSON.stringify(resultado)) throw new Error("Tentativa de realização divergente.");
      const modoEsperado = JSON.stringify({ requestId: tentativa.requestId, modo: tentativa.modo === "mediado" ? "mediado" : "legado" });
      const modoSalvo = sessionStorage.getItem(chaveModo);
      if (modoSalvo !== null && modoSalvo !== modoEsperado) throw new Error("Protocolo da tentativa divergente.");
      if (modoSalvo === null) sessionStorage.setItem(chaveModo, modoEsperado);
      sessionStorage.setItem(chave, JSON.stringify(resultado));
      setPendente(resultado);
      if (tentativa.modo !== "mediado") try { if (sessionStorage.getItem(chaveUpload) === JSON.stringify(tentativa)) { sessionStorage.removeItem(chaveUpload); setUpload(null); } } catch { /* A realização guardada permite recuperação; não apaga o objeto. */ }
      enviar.mutate(resultado);
      aguardandoComando = true;
    } catch { setMensagem(tentativa?.modo === "mediado"
      ? "Upload ou registro não confirmado. Preserve a tentativa e selecione o mesmo arquivo para repetir; se continuar pendente, procure suporte. Nenhum objeto será apagado."
      : "Upload ou registro não confirmado. Sem verificação dos bytes armazenados, a recuperação fica bloqueada; procure suporte. O objeto não será apagado."); }
    finally { setEnviandoArquivo(false); if (!aguardandoComando) trava.current = false; }
  }
  function repetir(pedido: Pedido) {
    if (trava.current || consultaConfirmacao.isPending || enviar.isPending) return;
    trava.current = true;
    enviar.mutate(pedido);
  }
  function consultar(pedido: Pedido) {
    if (trava.current || enviar.isPending || consultaConfirmacao.isPending) return;
    trava.current = true;
    consultaConfirmacao.mutate(pedido);
  }
  async function recuperarUpload(tentativa: Upload) {
    if (trava.current || pendente || tentativa.modo !== "mediado" || !mediadoHabilitado) return;
    trava.current = true; setEnviandoArquivo(true); setMensagem("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || !montado.current || sessionStorage.getItem(chaveUpload) !== JSON.stringify(tentativa) || sessionStorage.getItem(chave) !== null) throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_recuperar_ingestao_comprovante", {
        p_request_id: tentativa.requestId, p_cliente_id: clienteId, p_visita_id: visitaId, p_despesa_id: despesa.id, p_digest: tentativa.hash,
      });
      if (error) throw error;
      const r = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), visitaId: z.string().uuid(), despesaId: z.string().uuid(),
        digest: z.string().regex(/^[0-9a-f]{64}$/), objetoId: z.string().uuid().nullable(), integridadeBytesComprovada: z.literal(false) }).strict().parse(data);
      if (r.requestId !== tentativa.requestId || r.clienteId !== clienteId || r.visitaId !== visitaId || r.despesaId !== despesa.id || r.digest !== tentativa.hash) throw new Error("Resposta divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || !montado.current || sessionStorage.getItem(chaveUpload) !== JSON.stringify(tentativa) || sessionStorage.getItem(chave) !== null) throw new Error("Sessão ou tentativa alterada.");
      if (!r.objetoId) { setMensagem("Upload não confirmado. A ausência de confirmação não prova falha; preserve a tentativa."); return; }
      const pedido = validarRealizarDespesa({ requestId: tentativa.requestId, despesaId: despesa.id, visitaId,
        expectedRevision: tentativa.expectedRevision, realizadoCentavos: tentativa.realizadoCentavos, comprovanteObjetoId: r.objetoId });
      const modo = JSON.stringify({ requestId: tentativa.requestId, modo: "mediado" });
      const modoSalvo = sessionStorage.getItem(chaveModo);
      if (modoSalvo !== null && modoSalvo !== modo) throw new Error("Protocolo divergente.");
      if (modoSalvo === null) sessionStorage.setItem(chaveModo, modo);
      if (sessionStorage.getItem(chaveUpload) !== JSON.stringify(tentativa) || sessionStorage.getItem(chave) !== null) throw new Error("Tentativa alterada.");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido);
      setMensagem("Upload confirmado. A realização ainda não foi registrada e a consulta não verifica os bytes.");
    } catch { if (montado.current) setMensagem("Confirmação indisponível; tentativa preservada. Consulte suporte se necessário."); }
    finally { trava.current = false; if (montado.current) setEnviandoArquivo(false); }
  }
  if ((despesa.status !== "ativa" || despesa.realizadoCentavos !== null) && !pendente && !upload) return null;
  return <section aria-label={`Realização da despesa ${despesa.id}`}>
    {pendente && <p>A tentativa anterior pode já ter sido registrada. Repita o mesmo pedido; não envie outro comprovante.</p>}
    <label>Valor realizado em centavos <input inputMode="numeric" value={valor}
      onChange={(e) => setValor(e.target.value)} disabled={!!pendente || !!upload || enviar.isPending || enviandoArquivo} /></label>
    {valorValido && <p>Valor informado: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorExibido / 100)}.</p>}
    {valor && !valorValido && <p role="alert">Informe um valor inteiro em centavos dentro do limite aceito.</p>}
    <label>Comprovante (PDF, JPEG ou PNG, até 10 MB) <input ref={campoArquivo} type="file" accept="application/pdf,image/jpeg,image/png"
      disabled={!!pendente || enviar.isPending || enviandoArquivo || !!arquivo}
      onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></label>
    {arquivo && <p>Arquivo selecionado: {arquivo.name} · {arquivo.size} bytes.</p>}
    {arquivo && !pendente && !enviandoArquivo && !enviar.isPending && <button type="button" onClick={() => { setArquivo(null); if (campoArquivo.current) campoArquivo.current.value = ""; }}>Escolher outro arquivo</button>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {upload === "invalido" && <p role="alert">Tentativa de upload ilegível. Contate suporte; o objeto não será apagado.</p>}
    {upload && upload !== "invalido" && !pendente && <p role="alert">Upload pendente: valor {upload.realizadoCentavos} centavos, revisão {upload.expectedRevision}. {upload.modo === "mediado" && mediadoHabilitado ? "Selecione o mesmo arquivo para repetir a tentativa." : "Recuperação bloqueada até verificar a integridade do objeto armazenado; procure suporte."}</p>}
    {import.meta.env.VITE_SSO_RECUPERAR_INGESTAO_COMPROVANTE_ENABLED === "true" && upload && upload !== "invalido" && upload.modo === "mediado" && mediadoHabilitado && !pendente &&
      <button type="button" disabled={enviandoArquivo || enviar.isPending || consultaConfirmacao.isPending} onClick={() => void recuperarUpload(upload)}>Consultar confirmação do upload</button>}
    {!pendente && !upload && <label><input type="checkbox" checked={confirmado} disabled={enviandoArquivo || enviar.isPending} onChange={(e) => setFotoConfirmada(e.target.checked ? foto : null)} /> Conferi despesa, valor e comprovante.</label>}
    {pendente && pendente !== "invalido" ? <><button type="button" disabled={enviar.isPending || consultaConfirmacao.isPending} onClick={() => repetir(pendente)}>Repetir tentativa</button>
      {import.meta.env.VITE_SSO_CONSULTA_REALIZACAO_DESPESA_ENABLED === "true" && <button type="button" disabled={enviar.isPending || consultaConfirmacao.isPending} onClick={() => consultar(pendente)}>Consultar confirmação</button>}</>
      : <button type="button" disabled={!!pendente || (!!upload && (upload === "invalido" || upload.modo !== "mediado" || !mediadoHabilitado)) || !arquivo || (!upload && (!/^\d+$/.test(valor) || !confirmado)) || enviar.isPending || enviandoArquivo || despesa.status !== "ativa" || despesa.realizadoCentavos !== null} onClick={() => void iniciar()}>{upload && upload !== "invalido" && upload.modo === "mediado" ? "Retomar tentativa" : "Registrar realização"}</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
