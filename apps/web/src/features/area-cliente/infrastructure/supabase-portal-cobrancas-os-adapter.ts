import { z } from "zod";
import { portalCobrancaOsSchema } from "@sinergica/shared";
import { supabase } from "../../../lib/supabase-client";

const cobranca = portalCobrancaOsSchema;
export async function conferirSessaoCobranca(userId: string, signal?: AbortSignal) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
}
export async function listarCobrancasOs(clienteId: string, osId: string, apos: string | null, signal?: AbortSignal, userId?: string) {
  if (userId) await conferirSessaoCobranca(userId, signal);
  let consulta = supabase.schema("financeiro").rpc("sso_portal_cobrancas_os", { p_cliente_id: clienteId, p_os_id: osId, p_apos: apos });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  const resultado = z.array(cobranca).max(20).parse(data);
  let anterior = apos?.toLowerCase() ?? null;
  for (const item of resultado) {
    if (anterior !== null && item.lancamento_id.toLowerCase() <= anterior) throw new Error("Página inválida.");
    anterior = item.lancamento_id.toLowerCase();
  }
  if (userId) await conferirSessaoCobranca(userId, signal);
  return resultado;
}
