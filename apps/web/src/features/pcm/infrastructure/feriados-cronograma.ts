import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const item = z.object({ id: z.string().guid(), contrato_id: z.string().guid().nullable(), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fonte: z.string().min(1).max(500), motivo: z.string().min(1).max(2000), ativo: z.boolean(), revisao: z.number().int().positive() }).strict();
const pagina = z.object({ clienteId: z.string().guid(), contratoId: z.string().guid().nullable(), inicio: z.string(), fim: z.string(),
  total: z.number().int().nonnegative().max(2000), assinatura: z.string().regex(/^[a-f0-9]{32}$/), itens: z.array(item).max(50) }).strict();

/** Leitura declarativa limitada; não comprova feriados oficiais ou fotografia transacional. */
export async function consultarFeriadosCronograma(userId: string, clienteId: string, contratoId: string | null,
  inicio: string, fim: string, signal?: AbortSignal): Promise<{ datas: string[]; conteudo: string }> {
  let cursor: string | null = null; let assinatura: string | null = null; let total: number | null = null;
  const itens: z.infer<typeof item>[] = [];
  for (let indice = 0; indice < 41; indice++) {
    signal?.throwIfAborted();
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
    const consulta = supabase.schema("pcm").rpc("sso_fotografia_feriados", { p_ator_id: userId, p_cliente_id: clienteId,
      p_contrato_id: contratoId, p_inicio: inicio, p_fim: fim, p_apos: cursor, p_limite: 50 });
    const { data, error } = await (signal ? consulta.abortSignal(signal) : consulta);
    if (error) throw error;
    const p = pagina.parse(data);
    if (p.clienteId !== clienteId || p.contratoId !== contratoId || p.inicio !== inicio || p.fim !== fim ||
      (assinatura !== null && (p.assinatura !== assinatura || p.total !== total)) || itens.length + p.itens.length > p.total)
      throw new Error("Fotografia divergente.");
    assinatura = p.assinatura; total = p.total;
    for (const atual of p.itens) {
      if ((cursor && atual.id.toLowerCase() <= cursor.toLowerCase()) || atual.data < inicio || atual.data > fim ||
        (atual.contrato_id !== null && atual.contrato_id !== contratoId)) throw new Error("Página divergente.");
      cursor = atual.id; itens.push(atual);
    }
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
    if (itens.length === total) return { datas: [...new Set(itens.filter((f) => f.ativo).map((f) => f.data))].sort(), conteudo: JSON.stringify(itens) };
    if (p.itens.length < 50) throw new Error("Fotografia incompleta.");
  }
  throw new Error("Limite de páginas excedido.");
}
