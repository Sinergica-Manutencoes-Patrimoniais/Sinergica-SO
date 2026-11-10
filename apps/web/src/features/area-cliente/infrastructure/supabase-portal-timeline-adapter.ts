import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const evento = z.object({ id: z.string().guid(), status: z.enum(["solicitacao", "corretiva", "backlog", "planejamento", "em_execucao", "finalizado", "cancelado"]),
  ocorrido_em: z.string() }).strict();
type Cursor = { data: string; id: string } | null;
export async function listarTimelineOs(clienteId: string, osId: string, cursor: Cursor, signal?: AbortSignal) {
  let consulta = supabase.schema("pcm").rpc("sso_portal_timeline_os", {
    p_cliente_id: clienteId, p_os_id: osId, p_antes_data: cursor?.data ?? null, p_antes_id: cursor?.id ?? null,
  });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  return z.array(evento).parse(data);
}
