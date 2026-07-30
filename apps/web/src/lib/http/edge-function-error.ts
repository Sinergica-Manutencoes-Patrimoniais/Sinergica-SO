// Erro real de uma Edge Function invocada via `supabase.functions.invoke` — o SDK só expõe
// `error.message` genérico ("Edge Function returned a non-2xx status code"); o `detail`
// problem+json de verdade fica em `error.context` (a Response bruta). Ver `problem.ts`.

export async function erroDetalhado(error: unknown): Promise<Error> {
  const contexto = (error as { context?: Response })?.context;
  if (contexto && typeof contexto.json === "function") {
    try {
      const corpo = await contexto.clone().json();
      if (typeof corpo?.detail === "string" && corpo.detail) return new Error(corpo.detail);
    } catch {
      // corpo não era JSON (ou já consumido) — cai no erro original abaixo.
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}
