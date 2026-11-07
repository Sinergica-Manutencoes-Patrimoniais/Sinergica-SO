import { supabase } from "../../../../lib/supabase-client";

/** Confere identidade também após a resposta, inclusive quando a consulta é cancelada. */
export async function conferirSessaoDiagnostico(userId: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
}
