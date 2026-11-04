type Registrar = (args: { p_os_id: string; p_auvo_task_id: number; p_status_remoto: string }) => PromiseLike<{ error: unknown; data: unknown }>;
export async function registrarConflitoChamado(
  erro: { code?: string; message?: string }, registrar: Registrar,
  osId: string, taskId: number, status: string,
): Promise<"registrado" | "falhou" | "nao_aplicavel"> {
  if (erro.code !== "23514" || erro.message !== "chamado_encerrado_requer_reabertura_formal") return "nao_aplicavel";
  try {
    const resultado = await registrar({ p_os_id: osId, p_auvo_task_id: taskId, p_status_remoto: status });
    return !resultado.error && typeof resultado.data === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resultado.data) ? "registrado" : "falhou";
  } catch {
    return "falhou";
  }
}
