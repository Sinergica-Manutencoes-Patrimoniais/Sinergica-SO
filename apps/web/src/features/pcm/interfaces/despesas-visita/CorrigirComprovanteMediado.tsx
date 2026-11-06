import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ingerirComprovanteDespesa, type DespesaVisitaListada } from "../../infrastructure/supabase-despesas-visita-adapter";

export const pedidoSchema = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), visitaId: z.string().uuid(), despesaId: z.string().uuid(),
  revisao: z.number().int().positive(), valor: z.number().int().nonnegative().safe(), motivo: z.string().trim().min(1).max(2000),
  conferencia: z.string().trim().min(1).max(2000), hash: z.string().regex(/^[0-9a-f]{64}$/), tipo: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  tamanho: z.number().int().positive().max(10 * 1024 * 1024), objetoId: z.string().uuid().nullable() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; visitaId: string; despesa: Pick<DespesaVisitaListada, "id" | "status" | "revisao" | "realizadoCentavos"> };
async function hashArquivo(arquivo: File) {
  const bytes = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function CorrigirComprovanteMediado(props: Props) {
  if (import.meta.env.VITE_SSO_CORRECAO_COMPROVANTE_MEDIADA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesa.id])} {...props} />;
}

function Conteudo({ userId, clienteId, visitaId, despesa }: Props) {
  const chave = `sso-corrigir-comprovante-mediado:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const legado = `sso-corrigir-comprovante:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const legadoUpload = `sso-corrigir-comprovante-upload:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const trava = useRef(false);
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const client = useQueryClient();
  const [valor, setValor] = useState(String(despesa.realizadoCentavos ?? ""));
  const [motivo, setMotivo] = useState(""); const [conferencia, setConferencia] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null); const [fotoConfirmada, setFotoConfirmada] = useState<string | null>(null);
  const foto = JSON.stringify([userId, clienteId, visitaId, despesa.id, despesa.status, despesa.revisao, despesa.realizadoCentavos,
    valor, motivo, conferencia, arquivo && [arquivo.name, arquivo.size, arquivo.type, arquivo.lastModified]]);
  const fotoAtual = useRef(foto); fotoAtual.current = foto;
  const confirmado = fotoConfirmada === foto;
  const setConfirmado = (v: boolean) => setFotoConfirmada(v ? foto : null);
  const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.clienteId === clienteId && p.visitaId === visitaId && p.despesaId === despesa.id ? p : "invalido";
    } catch { return "invalido"; }
  });
  async function sessao() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId) throw new Error("Sessão alterada."); }
  async function finalizar(p: Pedido, mensagem: string) {
    try { await client.invalidateQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], refetchType: "none" });
      await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente."); sessionStorage.removeItem(chave);
      setPendente(null); setArquivo(null); setConfirmado(false); setAviso(mensagem);
      void client.refetchQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], type: "active" });
    } catch { setAviso("Correção confirmada, mas tentativa local não pôde ser limpa. Consulte suporte."); }
  }
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    await sessao(); if (!montado.current || !p.objetoId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_corrigir_realizacao_ingestao", { p_request_id: p.requestId, p_despesa_id: p.despesaId,
      p_expected_revision: p.revisao, p_valor_centavos: p.valor, p_comprovante_objeto_id: p.objetoId, p_motivo: p.motivo, p_conferencia_financeira: p.conferencia });
    if (error) throw error;
    if (!data || data.requestId !== p.requestId || data.aggregateId !== p.despesaId || data.revision !== p.revisao + 1 || data.state !== "ativa" || data.linkedIds?.visitaId !== visitaId) throw new Error("Resposta divergente.");
    await sessao();
  }, onSuccess: async (_data, p) => finalizar(p, "Correção confirmada; histórico preservado."), onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."), onSettled: () => { trava.current = false; } });
  const recibo = useMutation({ mutationFn: async (p: Pedido) => {
    await sessao(); if (!p.objetoId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_correcao_mediada", { p_cliente_id: clienteId, p_visita_id: visitaId,
      p_request_id: p.requestId, p_despesa_id: p.despesaId, p_revisao: p.revisao, p_valor: p.valor, p_objeto_id: p.objetoId, p_motivo: p.motivo, p_conferencia: p.conferencia });
    if (error) throw error;
    const r = z.object({ requestId: z.string().uuid(), despesaId: z.string().uuid(), visitaId: z.string().uuid(), clienteId: z.string().uuid(),
      revisao: z.number().int().positive(), confirmada: z.literal(true), integridadeBytesComprovada: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.despesaId !== p.despesaId || r.visitaId !== visitaId || r.clienteId !== clienteId || r.revisao !== p.revisao + 1) throw new Error("Recibo divergente.");
    await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
  }, onSuccess: async (_data, p) => finalizar(p, "Correção confirmada. O recibo não verifica os bytes do comprovante."),
    onError: () => setAviso("Confirmação indisponível. A tentativa foi preservada; ausência de recibo não comprova falha."), onSettled: () => { trava.current = false; } });
  async function recuperarUpload(p: Pedido) {
    if (trava.current || ocupado || p.objetoId) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      await sessao();
      if (!montado.current || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_recuperar_ingestao_comprovante", {
        p_request_id: p.requestId, p_cliente_id: p.clienteId, p_visita_id: p.visitaId, p_despesa_id: p.despesaId, p_digest: p.hash,
      });
      if (error) throw error;
      const r = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), visitaId: z.string().uuid(), despesaId: z.string().uuid(),
        digest: z.string().regex(/^[0-9a-f]{64}$/), objetoId: z.string().uuid().nullable(), integridadeBytesComprovada: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.visitaId !== p.visitaId || r.despesaId !== p.despesaId || r.digest !== p.hash) throw new Error("Resposta divergente.");
      await sessao();
      if (!montado.current || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      if (!r.objetoId) { setAviso("Upload não confirmado. A ausência de confirmação não prova falha; preserve a tentativa."); return; }
      const atualizado = pedidoSchema.parse({ ...p, objetoId: r.objetoId });
      sessionStorage.setItem(chave, JSON.stringify(atualizado)); setPendente(atualizado);
      setAviso("Upload confirmado. A correção ainda não foi registrada e os bytes não foram verificados nesta consulta.");
    } catch { if (montado.current) setAviso("Não foi possível recuperar a confirmação. A tentativa foi preservada."); }
    finally { trava.current = false; if (montado.current) setOcupado(false); }
  }
  async function executar() {
    if (trava.current || ocupado || recibo.isPending || pendente === "invalido") return;
    if (!pendente && (despesa.status !== "ativa" || despesa.realizadoCentavos === null || !confirmado || !arquivo)) return;
    trava.current = true; setOcupado(true); setAviso(""); let comando = false;
    try {
      let p = pendente;
      if (!p) {
        if (!arquivo || arquivo.size < 1 || arquivo.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(arquivo.type) || !/^\d{1,16}$/.test(valor)) throw new Error("Dados inválidos.");
        p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, visitaId, despesaId: despesa.id, revisao: despesa.revisao,
          valor: Number(valor), motivo, conferencia, hash: await hashArquivo(arquivo), tipo: arquivo.type, tamanho: arquivo.size, objetoId: null });
        await sessao(); if (!montado.current || fotoAtual.current !== foto || sessionStorage.getItem(chave) !== null || sessionStorage.getItem(legado) !== null || sessionStorage.getItem(legadoUpload) !== null) throw new Error("Dados alterados ou tentativa anterior pendente.");
        sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p);
      }
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      if (!p.objetoId) {
        if (!arquivo || arquivo.type !== p.tipo || arquivo.size !== p.tamanho || await hashArquivo(arquivo) !== p.hash) throw new Error("Selecione o mesmo arquivo.");
        await sessao(); if (!montado.current) throw new Error("Contexto encerrado.");
        const objetoId = await ingerirComprovanteDespesa(p.requestId, p.despesaId, arquivo); await sessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
        const atualizado = pedidoSchema.parse({ ...p, objetoId }); sessionStorage.setItem(chave, JSON.stringify(atualizado)); if (montado.current) setPendente(atualizado); p = atualizado;
      }
      // Uma mudança de Cliente ou desmontagem não deve iniciar a correção financeira.
      // Se o upload terminou, a tentativa com objetoId permanece recuperável.
      if (!montado.current) throw new Error("Contexto encerrado.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      envio.mutate(p); comando = true;
    } catch { if (montado.current) setAviso("Upload ou correção não confirmados. Preserve a tentativa e selecione o mesmo arquivo para repetir; procure suporte em caso de conflito."); }
    finally { if (montado.current) setOcupado(false); if (!comando) trava.current = false; }
  }
  return <section aria-label="Correção com comprovante mediado"><h5>Corrigir com novo comprovante mediado</h5>
    <p>Preserva o comprovante anterior e não altera lançamentos financeiros. A conferência financeira continua obrigatória.</p>
    <fieldset disabled={!!pendente || ocupado || envio.isPending}>
      <label>Valor realizado em centavos <input inputMode="numeric" value={valor} onChange={(e) => { setValor(e.target.value); setConfirmado(false); }} /></label>
      <label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmado(false); }} /></label>
      <label>Conferência financeira <textarea maxLength={2000} value={conferencia} onChange={(e) => { setConferencia(e.target.value); setConfirmado(false); }} /></label>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Conferi valor, comprovante e vínculos financeiros.</label>
    </fieldset>
    {(!pendente || (pendente !== "invalido" && !pendente.objetoId)) && <label>Comprovante PDF, JPEG ou PNG até 10 MB <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={ocupado || envio.isPending} onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setConfirmado(false); }} /></label>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" && <p>Correção pendente de {pendente.valor} centavos, revisão {pendente.revisao}. {!pendente.objetoId ? "Selecione o mesmo arquivo para repetir." : "O upload foi confirmado; repita a correção."}</p>}
    {import.meta.env.VITE_SSO_RECUPERAR_INGESTAO_COMPROVANTE_ENABLED === "true" && pendente && pendente !== "invalido" && !pendente.objetoId &&
      <button type="button" disabled={ocupado || envio.isPending || recibo.isPending} onClick={() => void recuperarUpload(pendente)}>Consultar confirmação do upload</button>}
    <button type="button" disabled={pendente === "invalido" || ocupado || envio.isPending || recibo.isPending || (!pendente && (!confirmado || !arquivo))} onClick={() => void executar()}>{pendente ? "Repetir tentativa" : "Registrar correção mediada"}</button>
    {import.meta.env.VITE_SSO_RECIBO_CORRECAO_MEDIADA_ENABLED === "true" && pendente && pendente !== "invalido" && pendente.objetoId &&
      <button type="button" disabled={ocupado || envio.isPending || recibo.isPending} onClick={() => { if (trava.current) return; trava.current = true; recibo.mutate(pendente); }}>Consultar confirmação</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
