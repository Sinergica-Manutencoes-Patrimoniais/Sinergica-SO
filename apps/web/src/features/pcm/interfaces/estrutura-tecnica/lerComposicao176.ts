import { supabase } from "../../../../lib/supabase-client";

type Fonte = "sistemas" | "locais" | "itens" | "vinculos" | "grupos" | "categorias";
export async function lerComposicao176(userId: string, clienteId: string, fonte: Fonte, offset: number, signal: AbortSignal, localId: string | null = null, sistemaId: string | null = null, apenasAtivos = false): Promise<unknown> {
  const antes = await supabase.auth.getUser();
  if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
  const { data, error } = await supabase.schema("pcm").rpc("sso_listar_composicao_estrutura_176", {
    p_ator: userId, p_cliente: clienteId, p_fonte: fonte, p_local: localId,
    p_sistema: sistemaId, p_apenas_ativos: apenasAtivos, p_offset: offset,
  }).abortSignal(signal);
  const depois = await supabase.auth.getUser();
  if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
  if (error) throw error;
  return data;
}
