import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { EntradaLevantamentos } from "../levantamentos/Conectado";
import { pedidoEstruturadoSchema, type PedidoEstruturado } from "./RecepcaoEstruturada";

type Tentativa = { chave: string; texto: string; pedido: PedidoEstruturado };
const prefixo = "sso-recepcao-estruturada:";

export function RecuperarRecepcaoEstruturada({ userId }: { userId: string }) {
  if (import.meta.env.VITE_SSO_RECEPCAO_ESTRUTURADA_ENABLED !== "true") return null;
  return <Lista key={userId} userId={userId} />;
}
function Lista({ userId }: { userId: string }) {
  const [aviso, setAviso] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recebido, setRecebido] = useState<{ clienteId: string; loteId: string } | null>(null);
  const [aberto, setAberto] = useState(false);
  const [, atualizar] = useState(0);
  const trava = useRef(false);
  const cache = useQueryClient();
  const tentativas: Tentativa[] = [];
  let invalida = false;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chave = sessionStorage.key(i);
      if (!chave?.startsWith(prefixo)) continue;
      let contexto: unknown;
      try { contexto = JSON.parse(chave.slice(prefixo.length)); } catch { continue; }
      if (!Array.isArray(contexto) || contexto[0] !== userId) continue;
      try {
        const texto = sessionStorage.getItem(chave);
        if (!texto || new TextEncoder().encode(texto).length > 1_200_000) throw new Error();
        const pedido = pedidoEstruturadoSchema.parse(JSON.parse(texto));
        if (contexto.length !== 3 || contexto[1] !== pedido.contexto.clienteId || contexto[2] !== pedido.contexto.envelopeId) throw new Error();
        tentativas.push({ chave, texto, pedido });
      } catch { invalida = true; }
    }
  } catch { invalida = true; }
  async function executar(t: Tentativa, acao: "consultar" | "repetir") {
    if (trava.current) return;
    if (acao === "repetir" && confirmacao !== JSON.stringify([t.chave, t.texto])) { setConfirmacao(null); setAviso("Confira a tentativa novamente."); return; }
    trava.current = true; setOcupado(true); setAviso("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(t.chave) !== t.texto) throw new Error();
      const corpo = acao === "consultar" ? { ...t.pedido, acao: "consultar" } : t.pedido;
      const { data, error } = await supabase.functions.invoke("pcm-receber-levantamento-estruturado", { body: corpo });
      if (error) throw error;
      const r = z.object({ estado: z.literal("recebido"), requestId: z.string().guid(), loteId: z.string().guid(),
        origemComprovada: z.literal(false), fotosImportadas: z.literal(false), cadastrosIncorporados: z.literal(false) }).strict().parse(data);
      if (r.requestId !== t.pedido.contexto.requestId) throw new Error();
      await cache.invalidateQueries({ queryKey: ["levantamentos", userId, t.pedido.contexto.clienteId, "lotes"], refetchType: "none" });
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || sessionStorage.getItem(t.chave) !== t.texto) throw new Error();
      sessionStorage.removeItem(t.chave); atualizar((n) => n + 1); setConfirmacao(null);
      setRecebido({ clienteId: t.pedido.contexto.clienteId, loteId: r.loteId }); setAberto(false);
      setAviso("Recepção confirmada. O lote continua pendente de conferência.");
    } catch { setAviso("Resultado não confirmado. A tentativa foi preservada; recibo ausente não prova que o envio falhou."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <section aria-label="Recuperar levantamento estruturado">
    {invalida && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {tentativas.map((t) => <section key={t.pedido.contexto.requestId}>
      <p>Recepção pendente: Cliente {t.pedido.contexto.clienteId} · envelope {t.pedido.contexto.envelopeId} · OS {t.pedido.contexto.osId}.</p>
      <button type="button" disabled={ocupado} onClick={() => void executar(t, "consultar")}>Consultar recibo</button>
      {confirmacao === JSON.stringify([t.chave, t.texto]) ? <div>
        <p>A repetição usa o mesmo pedido e poderá criar um lote pendente se a primeira tentativa não chegou.</p>
        <button type="button" disabled={ocupado} onClick={() => void executar(t, "repetir")}>Confirmar repetição</button>
        <button type="button" disabled={ocupado} onClick={() => setConfirmacao(null)}>Cancelar</button>
      </div> : <button type="button" disabled={ocupado} onClick={() => setConfirmacao(JSON.stringify([t.chave, t.texto]))}>Repetir mesmo pedido</button>}
    </section>)}
    {aviso && <p role="status">{aviso}</p>}
    {recebido && import.meta.env.VITE_SSO_LEVANTAMENTOS_ENABLED === "true" && <section>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar lote" : "Abrir conferência do lote"}</button>
      {aberto && <EntradaLevantamentos key={JSON.stringify([userId, recebido.clienteId, recebido.loteId])} habilitado={import.meta.env.VITE_SSO_LEVANTAMENTOS_ENABLED} userId={userId} clienteId={recebido.clienteId} loteRecebido={recebido.loteId} />}
    </section>}
  </section>;
}
