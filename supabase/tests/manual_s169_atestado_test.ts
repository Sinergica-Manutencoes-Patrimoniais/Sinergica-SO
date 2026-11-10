import { assinarAtestadoXlsx } from "../functions/_shared/cronograma-xlsx/atestado.ts";
const chave = new Uint8Array(32).fill(7);
const base = { ator: "16891000-0000-4000-8000-000000000001", cliente: "16891000-0000-4000-8000-000000000002", pedido: "16900000-0000-4000-8000-000000000301", lote: "16900000-0000-4000-8000-000000000302", fonte: "São Paulo", bytes: new TextEncoder().encode("abc"), matrizJson: "[[1]]", expira: 1800000000 };
Deno.test("vincula mensagem canônica à origem e matriz com HMAC", async () => {
  const resultado = await assinarAtestadoXlsx(chave, base);
  const esperado = ["sso-xlsx-v1", base.ator, base.cliente, base.pedido, base.lote, "53c3a36f205061756c6f", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "043f347c2cdc0d8ce70c38775d24e556c0290acf6d0c87a3a52aa85471cb8d02", "1800000000"].join("\n");
  if (resultado.mensagem !== esperado) throw new Error("mensagem divergente");
  if (resultado.assinatura !== "e43302101514f2a04919d73b6c163ba1970ae8f951cef6357bc61f6142b558fe") throw new Error("vetor HMAC divergente");
  const chaveCrypto = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const assinatura = Uint8Array.from((resultado.assinatura as string).match(/../g)!, (item) => parseInt(item, 16));
  if (!await crypto.subtle.verify("HMAC", chaveCrypto, assinatura, new TextEncoder().encode(esperado))) throw new Error("assinatura inválida");
});
Deno.test("mudança de matriz, arquivo ou identidade altera assinatura", async () => {
  const original = await assinarAtestadoXlsx(chave, base);
  for (const alteracao of [{ matrizJson: "[[2]]" }, { bytes: new TextEncoder().encode("abd") }, { cliente: "16891000-0000-4000-8000-000000000003" }]) {
    if ((await assinarAtestadoXlsx(chave, { ...base, ...alteracao })).assinatura === original.assinatura) throw new Error("assinatura não vinculou alteração");
  }
});
Deno.test("recusa chave curta e metadados fora dos limites", async () => {
  for (const [segredo, dados] of [[new Uint8Array(31), base], [chave, { ...base, ator: "invalido" }], [chave, { ...base, fonte: "" }], [chave, { ...base, expira: 0 }]] as const) {
    let rejeitou = false; try { await assinarAtestadoXlsx(segredo, dados); } catch { rejeitou = true; }
    if (!rejeitou) throw new Error("entrada inválida aceita");
  }
});
Deno.test("copia chave e dados antes de ceder execução", async () => {
  const segredo = new Uint8Array(chave); const dados = { ...base, bytes: new Uint8Array(base.bytes) };
  const esperado = await assinarAtestadoXlsx(chave, base);
  const pendente = assinarAtestadoXlsx(segredo, dados);
  segredo.fill(1); dados.bytes.fill(0); dados.cliente = "16891000-0000-4000-8000-000000000003";
  const resultado = await pendente;
  if (resultado.mensagem !== esperado.mensagem || resultado.assinatura !== esperado.assinatura) throw new Error("atestado misturou dados alterados");
});
