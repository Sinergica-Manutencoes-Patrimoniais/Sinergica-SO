import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const resultado = z.discriminatedUnion("estado", [
  z.object({ estado: z.literal("ausente") }).strict(),
  z.object({ estado: z.literal("reconciliacao") }).strict(),
  z.object({ estado: z.literal("encontrada"), loteId: uuid, revisao: z.number().int().positive().safe(), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
]);

/** Consulta não reserva origem nem autoriza sua alteração; servidor continua a arbitrar conflitos. */
export async function recuperarOrigemXlsx(userId: string, clienteId: string, fonteId: string, signal?: AbortSignal): Promise<z.infer<typeof resultado>> {
  const usuario = uuid.parse(userId).toLowerCase();
  const cliente = uuid.parse(clienteId);
  if (!fonteId || fonteId !== fonteId.trim() || fonteId.length > 188) throw new Error("Fonte inválida.");
  async function verificarSessao() {
    signal?.throwIfAborted();
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id.toLowerCase() !== usuario) throw new Error("Sessão alterada ou indisponível.");
    signal?.throwIfAborted();
  }
  await verificarSessao();
  let consulta = supabase.schema("pcm").rpc("sso_recuperar_origem_xlsx", { p_cliente: cliente, p_fonte: fonteId });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  await verificarSessao();
  return resultado.parse(data);
}
