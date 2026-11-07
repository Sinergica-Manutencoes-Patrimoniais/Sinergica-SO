import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { pedidoVinculoLocalizacaoSchema } from "./VincularLocalizacao";

const prefixo = "sso-vincular-localizacao:";
type Tentativa = { chaveStorage: string; texto: string; pedido: z.infer<typeof pedidoVinculoLocalizacaoSchema> };
const recibo = z.object({ requestId: z.string().guid(), aggregateId: z.string().guid(), revision: z.number().int().positive(), state: z.literal("pendente"), created: z.literal(false),
  linkedIds: z.object({ entidadeId: z.string().guid(), tipo: z.string() }).strict(), warnings: z.array(z.string()) }).strict();

export function RecuperarVinculosLocalizacao({ userId, clienteId }: { userId: string; clienteId: string }) {
  if (import.meta.env.VITE_SSO_RECIBO_VINCULO_LOCALIZACAO_ENABLED !== "true") return null;
  return <Lista key={JSON.stringify([userId, clienteId])} userId={userId} clienteId={clienteId} />;
}

function Lista({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [, atualizar] = useState(0); const [aviso, setAviso] = useState(""); const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false); const cache = useQueryClient(); const tentativas: Tentativa[] = []; let invalida = false;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chaveStorage = sessionStorage.key(i); if (!chaveStorage?.startsWith(prefixo)) continue;
      let contexto: unknown; try { contexto = JSON.parse(chaveStorage.slice(prefixo.length)); } catch { continue; }
      if (!Array.isArray(contexto) || contexto[0] !== userId || contexto[1] !== clienteId) continue;
      try { const texto = sessionStorage.getItem(chaveStorage); if (!texto || new TextEncoder().encode(texto).length > 20_000) throw new Error();
        const pedido = pedidoVinculoLocalizacaoSchema.parse(JSON.parse(texto));
        if (contexto.length !== 4 || contexto[2] !== pedido.loteId || contexto[3] !== pedido.chave) throw new Error();
        tentativas.push({ chaveStorage, texto, pedido });
      } catch { invalida = true; }
    }
  } catch { invalida = true; }
  async function consultar(t: Tentativa) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(t.chaveStorage) !== t.texto) throw new Error();
      const p = t.pedido;
      const payload = { operacao: "vincular_localizacao", loteId: p.loteId.toLowerCase(), expectedRevision: p.revisao,
        chave: p.chave, entidadeId: p.entidadeId.toLowerCase(), snapshot: p.snapshot, motivo: p.motivo.trim() };
      const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_vinculo_localizacao", { p_ator_id: userId, p_cliente_id: clienteId,
        p_request_id: p.requestId, p_lote_id: p.loteId, p_chave: p.chave, p_payload: payload });
      if (error) throw error;
      const r = recibo.parse(data);
      if (r.requestId !== p.requestId || r.aggregateId !== p.loteId || r.revision !== p.revisao + 1 || r.linkedIds.entidadeId !== p.entidadeId || r.linkedIds.tipo !== p.tipo) throw new Error();
      await cache.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId], refetchType: "none" });
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || sessionStorage.getItem(t.chaveStorage) !== t.texto) throw new Error();
      sessionStorage.removeItem(t.chaveStorage); atualizar((n) => n + 1); setAviso("Vínculo confirmado; o cadastro oficial não foi alterado.");
      void cache.refetchQueries({ queryKey: ["levantamentos", userId, clienteId], type: "active" });
    } catch { setAviso("Confirmação indisponível. A tentativa permanece guardada; isso não prova falha."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <section aria-label="Recuperar vínculos de localização"><h3>Vínculos aguardando confirmação</h3>
    <p>Somente tentativas guardadas nesta aba para o usuário e Cliente atuais. A consulta não repete o vínculo.</p>
    <button type="button" disabled={ocupado} onClick={() => atualizar((n) => n + 1)}>Atualizar tentativas</button>
    {invalida && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {tentativas.length === 0 && !invalida && <p>Nenhuma tentativa encontrada nesta aba.</p>}
    {tentativas.map((t) => <p key={t.chaveStorage}>Lote {t.pedido.loteId} · linha {t.pedido.chave} · {t.pedido.tipo} {t.pedido.entidadeId}. <button type="button" disabled={ocupado} onClick={() => void consultar(t)}>Consultar confirmação</button></p>)}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
