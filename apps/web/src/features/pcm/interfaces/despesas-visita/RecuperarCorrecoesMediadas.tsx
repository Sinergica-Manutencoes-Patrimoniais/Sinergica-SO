import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { CorrigirComprovanteMediado, pedidoSchema } from "./CorrigirComprovanteMediado";

type Tentativa = { chave: string; texto: string; pedido: z.infer<typeof pedidoSchema> };
export function RecuperarCorrecoesMediadas(props: { userId: string; clienteId: string; visitaId: string; despesasVisiveis: string[] }) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId])} {...props} />;
}
function Conteudo({ userId, clienteId, visitaId, despesasVisiveis }: { userId: string; clienteId: string; visitaId: string; despesasVisiveis: string[] }) {
  const prefixo = `sso-corrigir-comprovante-mediado:${userId}:${clienteId}:${visitaId}:`;
  const [aviso, setAviso] = useState(""); const [, atualizar] = useState(0); const trava = useRef(false); const client = useQueryClient();
  const tentativas: Tentativa[] = []; let invalida = false;
  try { for (let i = 0; i < sessionStorage.length; i++) { const chave = sessionStorage.key(i); if (!chave?.startsWith(prefixo)) continue;
    try { const texto = sessionStorage.getItem(chave); if (!texto || texto.length > 10000) throw new Error(); const p = pedidoSchema.parse(JSON.parse(texto));
      if (p.clienteId !== clienteId || p.visitaId !== visitaId || chave !== `${prefixo}${p.despesaId}`) throw new Error(); tentativas.push({ chave, texto, pedido: p });
    } catch { invalida = true; }
  } } catch { invalida = true; }
  async function sessao() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId) throw new Error("Sessão alterada."); }
  const consulta = useMutation({ mutationFn: async (t: Tentativa) => {
    const p = t.pedido; if (!p.objetoId) throw new Error("Upload ainda não confirmado.");
    await sessao(); if (sessionStorage.getItem(t.chave) !== t.texto) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_correcao_mediada", { p_cliente_id: clienteId, p_visita_id: visitaId,
      p_request_id: p.requestId, p_despesa_id: p.despesaId, p_revisao: p.revisao, p_valor: p.valor, p_objeto_id: p.objetoId, p_motivo: p.motivo, p_conferencia: p.conferencia });
    if (error) throw error;
    const r = z.object({ requestId: z.string().guid(), despesaId: z.string().guid(), visitaId: z.string().guid(), clienteId: z.string().guid(), revisao: z.number().int().positive(), confirmada: z.literal(true), integridadeBytesComprovada: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.despesaId !== p.despesaId || r.clienteId !== clienteId || r.visitaId !== visitaId || r.revisao !== p.revisao + 1) throw new Error("Recibo divergente.");
    await sessao(); if (sessionStorage.getItem(t.chave) !== t.texto) throw new Error("Tentativa alterada.");
  }, onSuccess: async (_data, t) => {
    try { await client.invalidateQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], refetchType: "none" }); await sessao();
      if (sessionStorage.getItem(t.chave) !== t.texto) throw new Error(); sessionStorage.removeItem(t.chave); atualizar(n => n + 1);
      setAviso("Correção confirmada; o recibo não verifica os bytes do comprovante."); void client.refetchQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], type: "active" });
    } catch { setAviso("Recibo confirmado, mas a tentativa não foi removida. Consulte suporte."); }
  }, onError: () => setAviso("Recibo indisponível. A tentativa foi preservada; ausência não comprova falha."), onSettled: () => { trava.current = false; } });
  if (!tentativas.length && !invalida && !aviso) return null;
  return <section aria-label="Recuperar correções de comprovante"><h5>Recuperar correções de comprovante</h5>
    <p>Consulta a mesma tentativa mesmo que a despesa não esteja na lista; não repete a alteração.</p>
    {invalida && <p role="alert">Há tentativa local ilegível. Consulte suporte.</p>}
    <ul>{tentativas.map(t => <li key={t.chave}>Despesa {t.pedido.despesaId} · revisão {t.pedido.revisao} · {t.pedido.valor} centavos
      {t.pedido.objetoId ? <button type="button" disabled={consulta.isPending} onClick={() => { if (trava.current) return; trava.current = true; consulta.mutate(t); }}>Consultar confirmação</button>
        : <><span> · Upload incerto: selecione o mesmo arquivo para repetir ou consulte suporte.</span>
          {!despesasVisiveis.includes(t.pedido.despesaId) && <CorrigirComprovanteMediado userId={userId} clienteId={clienteId} visitaId={visitaId}
            despesa={{ id: t.pedido.despesaId, status: "cancelada", revisao: t.pedido.revisao, realizadoCentavos: null }} />}</>}</li>)}</ul>
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
