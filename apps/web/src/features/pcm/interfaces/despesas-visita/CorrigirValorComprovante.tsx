import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { enviarComprovanteDespesa, type DespesaVisitaListada } from "../../infrastructure/supabase-despesas-visita-adapter";
import { CorrigirComprovanteMediado } from "./CorrigirComprovanteMediado";

const esquema = z.object({ requestId: z.string().guid(), despesaId: z.string().guid(), visitaId: z.string().guid(),
  expectedRevision: z.number().int().positive(), valorCentavos: z.number().int().nonnegative().safe(),
  comprovanteObjetoId: z.string().guid().nullable(), motivo: z.string().trim().min(1).max(2000),
  conferencia: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof esquema>;
type Props = { userId: string; clienteId: string; visitaId: string; despesa: DespesaVisitaListada };
export function CorrigirValorComprovante(props: Props) {
  const legadoHabilitado = import.meta.env.VITE_SSO_CORRIGIR_COMPROVANTE_DESPESA_ENABLED === "true";
  const mediadoHabilitado = import.meta.env.VITE_SSO_CORRECAO_COMPROVANTE_MEDIADA_ENABLED === "true";
  if (!legadoHabilitado && !mediadoHabilitado) return null;
  if (props.despesa.status !== "ativa" || props.despesa.realizadoCentavos === null) {
    // Preserve access to an uncertain request even if the server state changed.
    // An unreadable store must also fail closed rather than hiding the attempt.
    try {
      const sufixo = `${props.userId}:${props.clienteId}:${props.visitaId}:${props.despesa.id}`;
      if (sessionStorage.getItem(`sso-corrigir-comprovante:${sufixo}`) === null &&
          sessionStorage.getItem(`sso-corrigir-comprovante-upload:${sufixo}`) === null &&
          sessionStorage.getItem(`sso-corrigir-comprovante-mediado:${sufixo}`) === null) return null;
    } catch { /* Show the recovery warning. */ }
  }
  return <>{legadoHabilitado && <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesa.id])} {...props} />}<CorrigirComprovanteMediado {...props} /></>;
}
function Conteudo({ userId, clienteId, visitaId, despesa }: Props) {
  const chave = `sso-corrigir-comprovante:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const chaveUpload = `sso-corrigir-comprovante-upload:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const chaveMediada = `sso-corrigir-comprovante-mediado:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const trava = useRef(false);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(String(despesa.realizadoCentavos));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [caminho] = useState(() => `${clienteId}/${despesa.id}/${crypto.randomUUID()}`);
  const [motivo, setMotivo] = useState(""); const [conferencia, setConferencia] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [uploadIncerto, setUploadIncerto] = useState(() => { try { return sessionStorage.getItem(chaveUpload) !== null; } catch { return true; } });
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = esquema.parse(JSON.parse(salvo)); return p.despesaId === despesa.id && p.visitaId === visitaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const fotografia = JSON.stringify([userId, clienteId, visitaId, despesa.id, despesa.revisao, despesa.realizadoCentavos, valor, arquivo?.name ?? null, arquivo?.size ?? null, arquivo?.lastModified ?? null, motivo.trim(), conferencia.trim()]);
  const confirmado = confirmacao === fotografia;
  async function conferirSessao() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada."); }
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_corrigir_realizacao_despesa", {
      p_request_id: p.requestId, p_despesa_id: p.despesaId, p_expected_revision: p.expectedRevision,
      p_valor_centavos: p.valorCentavos, p_comprovante_objeto_id: p.comprovanteObjetoId,
      p_motivo: p.motivo, p_conferencia_financeira: p.conferencia });
    if (error) throw error;
    if (!data || data.requestId !== p.requestId || data.aggregateId !== p.despesaId || data.revision !== p.expectedRevision + 1 ||
      data.state !== "ativa" || data.linkedIds?.visitaId !== p.visitaId) throw new Error("Resposta inválida.");
    await conferirSessao();
  }, onSuccess: async (_resultado, pedido) => { try {
    await queryClient.invalidateQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], refetchType: "none" });
    await conferirSessao();
    if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente");
    const uploadSalvo = sessionStorage.getItem(chaveUpload);
    if (uploadSalvo !== null) {
      const marcador = z.object({ requestId: z.string().guid() }).strict().parse(JSON.parse(uploadSalvo));
      if (marcador.requestId !== pedido.requestId) throw new Error("Upload divergente");
      sessionStorage.removeItem(chaveUpload); setUploadIncerto(false);
    }
    sessionStorage.removeItem(chave);
  } catch { setMensagem("Correção registrada; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setConfirmacao(null); setMensagem("Correção registrada. Histórico e Financeiro permanecem preservados.");
    void queryClient.refetchQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], type: "active" }); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."), onSettled: () => { trava.current = false; } });
  function registrar(p: Pedido, sobTrava = false): boolean {
    if (trava.current && !sobTrava) return false;
    try { const salvo = sessionStorage.getItem(chave); if ((salvo !== null && salvo !== JSON.stringify(p)) || (salvo === null && pendente)) throw new Error("Tentativa divergente"); if (salvo === null) sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setMensagem("Não foi possível guardar tentativa; correção não enviada."); return false; }
    trava.current = true; setPendente(p); setMensagem(""); enviar.mutate(p); return true; }
  async function iniciar() {
    if (despesa.status !== "ativa" || despesa.realizadoCentavos === null || pendente || uploadIncerto || enviar.isPending || ocupado || trava.current || !confirmado) return;
    trava.current = true;
    setOcupado(true);
    let aguardandoComando = false;
    try {
      const antes = esquema.parse({ requestId: crypto.randomUUID(), despesaId: despesa.id, visitaId,
        expectedRevision: despesa.revisao, valorCentavos: /^\d+$/.test(valor) ? Number(valor) : NaN,
        comprovanteObjetoId: null, motivo, conferencia });
      if (arquivo && (arquivo.size <= 0 || arquivo.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(arquivo.type))) {
        setMensagem("Arquivo inválido. Selecione PDF, JPEG ou PNG de até 10 MB; nada foi enviado.");
        return;
      }
      if (sessionStorage.getItem(chave) !== null || sessionStorage.getItem(chaveUpload) !== null || sessionStorage.getItem(chaveMediada) !== null) throw new Error("Tentativa anterior pendente");
      await conferirSessao();
      if (arquivo) { sessionStorage.setItem(chaveUpload, JSON.stringify({ requestId: antes.requestId })); setUploadIncerto(true); }
      const objeto = arquivo ? await enviarComprovanteDespesa(caminho, arquivo, true) : null;
      await conferirSessao();
      if (arquivo && sessionStorage.getItem(chaveUpload) !== JSON.stringify({ requestId: antes.requestId })) throw new Error("Upload divergente.");
      aguardandoComando = registrar({ ...antes, comprovanteObjetoId: objeto }, true);
    } catch { setMensagem("Correção não confirmada. Upload incerto não pode ser recuperado sem verificar os bytes armazenados; procure suporte. Nenhum objeto será apagado."); }
    finally { setOcupado(false); if (!aguardandoComando) trava.current = false; }
  }
  return <section aria-label="Correção de valor e comprovante"><h5>Corrigir valor ou comprovante</h5>
    <p>O original fica no histórico. Vínculos financeiros ativos ou com alocação exigem reconciliação; nenhum lançamento é alterado aqui.</p>
    <fieldset disabled={!!pendente || uploadIncerto || enviar.isPending || ocupado}>
      <label>Valor realizado em centavos <input inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
      <label>Novo comprovante opcional (PDF, JPEG ou PNG, até 10 MB) <input ref={campoArquivo} type="file" accept="application/pdf,image/jpeg,image/png"
        disabled={!!arquivo} onChange={(e) => { setConfirmacao(null); setArquivo(e.target.files?.[0] ?? null); }} /></label>
      {arquivo && <><p>Arquivo selecionado: {arquivo.name} · {arquivo.size} bytes.</p><button type="button" onClick={() => { setArquivo(null); setConfirmacao(null); if (campoArquivo.current) campoArquivo.current.value = ""; }}>Escolher outro arquivo</button></>}
      <label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label>Como conferiu vínculos financeiros <textarea maxLength={2000} value={conferencia} onChange={(e) => setConferencia(e.target.value)} /></label>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Confirmei os dados e a revisão financeira.</label>
      <button type="button" disabled={!confirmado} onClick={() => void iniciar()}>Registrar correção</button>
    </fieldset>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {uploadIncerto && !pendente && <p role="alert">Upload pendente sem prova de integridade. Procure suporte; o objeto não será apagado.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
