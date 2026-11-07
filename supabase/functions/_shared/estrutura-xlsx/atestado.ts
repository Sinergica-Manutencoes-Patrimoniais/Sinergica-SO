const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Entrada = { ator: string; cliente: string; pedido: string; origem: string; aba: string; destino: "lote" | "quarentena"; bytes: Uint8Array; linhasJson: string; expira: number };

/** Assina conteúdo produzido pelo servidor; não autoriza gravação por si só. */
export async function assinarEstruturaXlsx(chave: Uint8Array, entrada: Entrada) {
  const { ator, cliente, pedido, origem, aba, destino, linhasJson, expira } = entrada;
  const linhasBytes = encoder.encode(linhasJson);
  if (chave.byteLength !== 32 || ![ator, cliente, pedido].every((v) => uuid.test(v)) || !origem || origem !== origem.trim() || origem.length > 200 ||
    !aba || aba.length > 31 || !["lote", "quarentena"].includes(destino) || !entrada.bytes.byteLength || entrada.bytes.byteLength > 5_242_880 ||
    !linhasBytes.length || linhasBytes.length > 1_048_576 || !Number.isSafeInteger(expira) || expira < 1 || expira > 9_999_999_999) throw new Error("Atestado inválido.");
  let linhas: unknown;
  try { linhas = JSON.parse(linhasJson); } catch { throw new Error("Linhas inválidas."); }
  if (!Array.isArray(linhas) || linhas.length < 1 || linhas.length > 1000) throw new Error("Linhas inválidas.");
  const bytes = new Uint8Array(entrada.bytes);
  const [hashArquivo, hashLinhas] = await Promise.all([crypto.subtle.digest("SHA-256", bytes), crypto.subtle.digest("SHA-256", linhasBytes)]);
  const mensagem = ["sso-estrutura-xlsx-v1", ator, cliente, pedido, hex(encoder.encode(origem)), hex(encoder.encode(aba)), destino,
    hex(new Uint8Array(hashArquivo)), hex(new Uint8Array(hashLinhas)), String(expira)].join("\n");
  const segredo = await crypto.subtle.importKey("raw", new Uint8Array(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return { assinatura: hex(new Uint8Array(await crypto.subtle.sign("HMAC", segredo, encoder.encode(mensagem)))) };
}
