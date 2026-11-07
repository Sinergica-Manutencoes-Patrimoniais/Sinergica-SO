import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { EntradaLevantamentos } from "../levantamentos/Conectado";
import { pedidoRecepcaoEnvelope } from "./RecepcaoEnvelope";

type Pedido = z.infer<typeof pedidoRecepcaoEnvelope>;
type Tentativa = { chave: string; texto: string; pedido: Pedido };
type Acao = { tentativa: Tentativa; tipo: "consultar" | "repetir" };

export function RecuperarRecepcaoEnvelope({ userId }: { userId: string }) {
  if (import.meta.env.VITE_SSO_RECEPCAO_MANUAL_ENVELOPE_ENABLED !== "true") return null;
  return <Lista key={userId} userId={userId} />;
}

function Lista({ userId }: { userId: string }) {
  const [aviso, setAviso] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [recebido, setRecebido] = useState<{ clienteId: string; loteId: string } | null>(null);
  const [conferenciaAberta, setConferenciaAberta] = useState(false);
  const [, atualizar] = useState(0);
  const trava = useRef(false);
  const cache = useQueryClient();
  const tentativas: Tentativa[] = [];
  let invalida = false;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chave = sessionStorage.key(i);
      if (!chave?.startsWith("sso-recepcao-envelope:")) continue;
      let contexto: unknown;
      try { contexto = JSON.parse(chave.slice("sso-recepcao-envelope:".length)); } catch { continue; }
      if (!Array.isArray(contexto) || contexto[0] !== userId) continue;
      try {
        const texto = sessionStorage.getItem(chave);
        // Inclui metadados além do limite do conteúdo estruturado da recepção.
        if (!texto || new TextEncoder().encode(texto).length > 1_401_000) throw new Error();
        const p = pedidoRecepcaoEnvelope.parse(JSON.parse(texto));
        if (contexto.length !== 3 || contexto[1] !== p.clienteId || contexto[2] !== p.envelopeId) throw new Error();
        tentativas.push({ chave, texto, pedido: p });
      } catch { invalida = true; }
    }
  } catch { invalida = true; }
  const consulta = useMutation({
    mutationFn: async ({ tentativa: t, tipo }: Acao) => {
      if (sessionStorage.getItem(t.chave) !== t.texto) throw new Error("Tentativa alterada.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const p = t.pedido;
      const { data, error } = await supabase.schema("pcm").rpc(tipo === "consultar" ? "sso_consultar_recepcao_envelope_mediada" : "sso_receber_envelope_campo_mediada", {
        p_ator_id: userId, p_cliente_id: p.clienteId, p_os_id: p.osId, p_envelope_id: p.envelopeId,
        p_request_id: p.requestId, p_linhas: p.linhas, p_fotos: p.fotos,
      });
      if (error) throw error;
      const r = z.object({ requestId: z.string().guid(), envelopeId: z.string().guid(), loteId: z.string().guid(), estado: z.literal("pendente"), origemComprovada: z.literal(false), fotosImportadas: z.literal(false), cadastrosIncorporados: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.envelopeId !== p.envelopeId) throw new Error("Recibo divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return r;
    },
    onSuccess: async (r, { tentativa: t }: Acao) => {
      try {
        await cache.invalidateQueries({ queryKey: ["levantamentos", userId, t.pedido.clienteId, "lotes"] });
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(t.chave) !== t.texto) throw new Error();
        sessionStorage.removeItem(t.chave); atualizar((n) => n + 1);
        setConfirmando(null);
        setRecebido({ clienteId: t.pedido.clienteId, loteId: r.loteId });
        setConferenciaAberta(false);
        setAviso(`Recepção confirmada no lote ${r.loteId}. Dados seguem pendentes de conferência.`);
      } catch { setAviso("Não foi possível concluir a conferência da sessão ou da tentativa. Consulte o recibo antes de outra recepção."); }
    },
    onError: () => setAviso("Resultado não confirmado. A tentativa foi preservada; consulte suporte antes de criar outra."),
    onSettled: () => { trava.current = false; },
  });
  function executar(t: Tentativa, tipo: Acao["tipo"]) {
    if (trava.current) return;
    if (tipo === "repetir" && confirmando !== JSON.stringify([t.chave, t.texto])) {
      setAviso("A tentativa mudou. Confira novamente antes de repetir.");
      setConfirmando(null);
      return;
    }
    trava.current = true;
    consulta.mutate({ tentativa: t, tipo });
  }
  return <section aria-label="Recuperar recepções de campo">
    {invalida && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {tentativas.map((t) => <section key={t.pedido.requestId}>
      <p>Recepção pendente para envelope {t.pedido.envelopeId} · OS {t.pedido.osId} · {t.pedido.linhas.length} linha(s) · {t.pedido.fotos.length} referência(s) declarada(s).</p>
      <button type="button" disabled={consulta.isPending} onClick={() => executar(t, "consultar")}>Consultar recibo</button>
      {confirmando === JSON.stringify([t.chave, t.texto]) ? <div>
        <p>Repetir usa exatamente o pedido guardado. Se ainda não foi recebido, criará um lote pendente de conferência; não importa fotos nem incorpora cadastros.</p>
        <button type="button" disabled={consulta.isPending} onClick={() => executar(t, "repetir")}>Confirmar repetição</button>
        <button type="button" disabled={consulta.isPending} onClick={() => setConfirmando(null)}>Cancelar</button>
      </div> : <button type="button" disabled={consulta.isPending} onClick={() => setConfirmando(JSON.stringify([t.chave, t.texto]))}>Repetir mesma recepção</button>}
    </section>)}
    {aviso && <p role="status">{aviso}</p>}
    {recebido && import.meta.env.VITE_SSO_LEVANTAMENTOS_ENABLED === "true" && <section aria-label="Conferência do lote recuperado">
      <button type="button" aria-expanded={conferenciaAberta} onClick={() => setConferenciaAberta((aberta) => !aberta)}>{conferenciaAberta ? "Ocultar conferência" : "Abrir conferência do lote"}</button>
      {conferenciaAberta && <EntradaLevantamentos key={JSON.stringify([userId, recebido.clienteId, recebido.loteId])} habilitado={import.meta.env.VITE_SSO_LEVANTAMENTOS_ENABLED} userId={userId} clienteId={recebido.clienteId} loteRecebido={recebido.loteId} />}
    </section>}
  </section>;
}
