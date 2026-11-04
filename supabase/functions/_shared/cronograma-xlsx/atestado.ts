type Entrada = { ator: string; cliente: string; pedido: string; lote: string; fonte: string; bytes: Uint8Array; matrizJson: string; expira: number };
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Somente preparação: a gravação deve verificar atestado, autorização e replay no banco. */
export async function assinarAtestadoXlsx(chave: Uint8Array, entrada: Entrada): Promise<{ mensagem: string; assinatura: string }> {
  const { ator, cliente, pedido, lote, fonte, expira, matrizJson } = entrada;
  const chaveCopia = new Uint8Array(chave);
  if (chave.byteLength !== 32 || ![entrada.ator, entrada.cliente, entrada.pedido, entrada.lote].every((valor) => uuid.test(valor)) || !entrada.fonte || entrada.fonte !== entrada.fonte.trim() || entrada.fonte.length > 188 || !entrada.bytes.byteLength || entrada.bytes.byteLength > 5_242_880 || !Number.isSafeInteger(entrada.expira) || entrada.expira < 1 || entrada.expira > 9_999_999_999) throw new Error("Dados de atestado inválidos.");
  const matrizBytes = encoder.encode(matrizJson);
  if (!matrizBytes.length || matrizBytes.length > 1_048_576) throw new Error("Matriz inválida.");
  let matriz: unknown;
  try { matriz = JSON.parse(matrizJson); } catch { throw new Error("Matriz inválida."); }
  if (!Array.isArray(matriz) || !matriz.every(Array.isArray)) throw new Error("Matriz inválida.");
  const arquivo = new Uint8Array(entrada.bytes);
  const [hashArquivo, hashMatriz] = await Promise.all([crypto.subtle.digest("SHA-256", arquivo), crypto.subtle.digest("SHA-256", matrizBytes)]);
  const mensagem = ["sso-xlsx-v1", ator, cliente, pedido, lote, hex(encoder.encode(fonte)), hex(new Uint8Array(hashArquivo)), hex(new Uint8Array(hashMatriz)), String(expira)].join("\n");
  const segredo = await crypto.subtle.importKey("raw", chaveCopia, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", segredo, encoder.encode(mensagem));
  return { mensagem, assinatura: hex(new Uint8Array(assinatura)) };
}
