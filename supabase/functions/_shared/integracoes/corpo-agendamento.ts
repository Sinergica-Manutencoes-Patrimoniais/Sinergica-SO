import { HttpError } from "../auth.ts";

/** Aceita apenas corpo vazio ou objeto vazio, com limites de bytes e tempo. */
export async function validarCorpoAgendamento(req: Request): Promise<void> {
  const tamanho = req.headers.get("content-length");
  if (tamanho !== null && (!/^\d+$/.test(tamanho) || Number(tamanho) > 256)) throw new HttpError(413, "Corpo excede limite");
  if (!req.body) return;
  const leitor = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const expiracao = new Promise<never>((_, rejeitar) => {
    prazo = setTimeout(() => { void leitor.cancel().catch(() => {}); rejeitar(new HttpError(408, "Leitura excedeu o prazo")); }, 10_000);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([leitor.read(), expiracao]);
      if (done) break;
      total += value.byteLength;
      if (total > 256) { void leitor.cancel().catch(() => {}); throw new HttpError(413, "Corpo excede limite"); }
      partes.push(value);
    }
  } finally {
    if (prazo !== undefined) clearTimeout(prazo);
    try { leitor.releaseLock(); } catch { /* Cancelamento pode continuar em voo. */ }
  }
  const bytes = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) { bytes.set(parte, posicao); posicao += parte.length; }
  let corpo: string;
  try { corpo = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim(); }
  catch { throw new HttpError(400, "Corpo inválido"); }
  if (corpo !== "" && corpo !== "{}") throw new HttpError(400, "Corpo inválido");
}
