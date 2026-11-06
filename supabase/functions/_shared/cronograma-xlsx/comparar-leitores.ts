import { processarXlsxIncrementalIsolado, processarXlsxIsolado } from "./processar-isolado.ts";

type Resultado = Awaited<ReturnType<typeof processarXlsxIsolado>>;
type Leitor = (bytes: Uint8Array, fonte: string, cliente: string, signal?: AbortSignal) => Promise<Resultado>;
type Comparacao =
  | { estado: "ambos_falharam" | "apenas_dom_processou" | "apenas_incremental_processou" }
  | { estado: "comparado"; arquivo: boolean; matriz: boolean; previa: boolean; evidencias: boolean; equivalentes: boolean };

/**
 * Diagnóstico local, sem persistência: não libera o parser nem comprova segurança.
 * Executa sequencialmente para não manter dois workers de leitura simultâneos.
 * A comparação é exata e pode sinalizar diferenças de representação semanticamente equivalentes.
 */
export async function compararLeitoresXlsx(
  bytes: Uint8Array, fonte: string, cliente: string, signal?: AbortSignal,
  leitores: { dom: Leitor; incremental: Leitor } = { dom: processarXlsxIsolado, incremental: processarXlsxIncrementalIsolado },
): Promise<Comparacao> {
  signal?.throwIfAborted();
  if (!bytes.byteLength || bytes.byteLength > 5_242_880) throw new Error("Arquivo comprimido inválido.");
  // Cópias distintas evitam que um leitor altere os bytes recebidos pelo outro.
  const original = new Uint8Array(bytes);
  let dom: Resultado | null = null;
  let incremental: Resultado | null = null;
  try { dom = await leitores.dom(new Uint8Array(original), fonte, cliente, signal); }
  catch { signal?.throwIfAborted(); }
  signal?.throwIfAborted();
  try { incremental = await leitores.incremental(new Uint8Array(original), fonte, cliente, signal); }
  catch { signal?.throwIfAborted(); }
  signal?.throwIfAborted();
  if (!dom && !incremental) return { estado: "ambos_falharam" };
  if (dom && !incremental) return { estado: "apenas_dom_processou" };
  if (!dom && incremental) return { estado: "apenas_incremental_processou" };
  if (!dom || !incremental) throw new Error("Comparação indisponível.");
  const arquivo = dom.sha256 === incremental.sha256;
  const matriz = JSON.stringify(dom.matriz) === JSON.stringify(incremental.matriz);
  const previa = JSON.stringify(dom.previa) === JSON.stringify(incremental.previa);
  const evidencias = JSON.stringify(dom.evidencias) === JSON.stringify(incremental.evidencias);
  return { estado: "comparado", arquivo, matriz, previa, evidencias, equivalentes: arquivo && matriz && previa && evidencias };
}
