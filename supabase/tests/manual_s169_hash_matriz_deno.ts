// Executado apenas pelo teste Playwright de equivalência; imprime somente o hash da matriz.
import { DOMParser as XmlDomParser } from "npm:@xmldom/xmldom@0.9.12";
import { processarXlsxCronograma } from "../../apps/web/src/features/pcm/application/processar-xlsx-cronograma.ts";
const nome = Deno.args[0];
if (nome !== "plano-rimini-2026-final.xlsx" && nome !== "plano-i-home-2026.xlsx") throw new Error("fonte não permitida");
const parser = { parseFromString(xml: string, tipo: string) { return new XmlDomParser({ onError: (_nivel, mensagem) => { throw new Error(mensagem); } }).parseFromString(xml, tipo); } };
const bytes = await Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`);
const resultado = await processarXlsxCronograma(bytes, "fonte", "cliente", parser);
if (!resultado.matriz) throw new Error("matriz não conferível");
const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(resultado.matriz)));
console.log(Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(""));
