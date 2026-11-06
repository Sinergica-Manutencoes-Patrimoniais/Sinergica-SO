import { SaxesParser } from "npm:saxes@6.0.0";
import { criarLimiteEstruturalXml, excedeLimiteUtf8 } from "./limites-incrementais.ts";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const TAMANHO_MAXIMO_XML = 4_194_304;
const TAMANHO_MAXIMO_TEXTO = 4000;
const QUANTIDADE_MAXIMA = 100_000;

/** Experimento sem rede ou persistência; não substitui isolamento ou teste de equivalência. */
export function interpretarStringsIncrementais(xml: string, signal?: AbortSignal): string[] {
  if (excedeLimiteUtf8(xml, TAMANHO_MAXIMO_XML) || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))
    throw new Error("XML extenso ou não permitido.");

  const sax = new SaxesParser({ xmlns: true });
  const verificarEstrutura = criarLimiteEstruturalXml();
  const resultado: string[] = [];
  let profundidade = 0;
  let raizValida = false;
  let emItem = false;
  let emRun = false;
  let capturaProfundidade: number | null = null;
  let texto = "";
  let diretos = 0;
  let runs = 0;
  let textosRun = 0;
  let trechos = 0;

  sax.on("opentag", (tag) => {
    verificarEstrutura(profundidade);
    if (profundidade === 0) {
      if (tag.uri !== NS || tag.local !== "sst") throw new Error("XML de strings inválido.");
      raizValida = true;
    }
    if (profundidade === 1 && tag.uri === NS && tag.local === "si") {
      if (resultado.length >= QUANTIDADE_MAXIMA) throw new Error("Strings demais.");
      emItem = true; texto = ""; diretos = 0; runs = 0; trechos = 0;
    } else if (emItem && profundidade === 2 && tag.uri === NS && tag.local === "r") {
      emRun = true; runs++; textosRun = 0;
    } else if (emItem && tag.uri === NS && tag.local === "t" &&
      (profundidade === 2 || (profundidade === 3 && emRun))) {
      if (profundidade === 2) diretos++;
      else textosRun++;
      capturaProfundidade = profundidade;
      trechos++;
    }
    profundidade++;
  });
  const adicionar = (parte: string) => {
    if (capturaProfundidade !== null) {
      texto += parte;
      // O teto em caracteres evita acumular texto muito grande antes da medição em UTF-8.
      if (texto.length > TAMANHO_MAXIMO_TEXTO) throw new Error("Texto extenso.");
    }
  };
  sax.on("text", adicionar);
  sax.on("cdata", adicionar);
  sax.on("closetag", (tag) => {
    profundidade--;
    if (capturaProfundidade === profundidade) capturaProfundidade = null;
    if (emItem && emRun && profundidade === 2 && tag.uri === NS && tag.local === "r") {
      if (textosRun !== 1) throw new Error("Texto rico inválido.");
      emRun = false;
    }
    if (emItem && profundidade === 1 && tag.uri === NS && tag.local === "si") {
      if (diretos > 1 || (diretos && runs)) throw new Error("Texto ambíguo.");
      if (!trechos) throw new Error("Texto ausente.");
      if (excedeLimiteUtf8(texto, TAMANHO_MAXIMO_TEXTO)) throw new Error("Texto extenso.");
      resultado.push(texto);
      emItem = false;
    }
  });
  for (let posicao = 0; posicao < xml.length; posicao += 16_384) {
    signal?.throwIfAborted();
    sax.write(xml.slice(posicao, posicao + 16_384));
  }
  signal?.throwIfAborted();
  sax.close();
  if (!raizValida) throw new Error("XML de strings inválido.");
  return resultado;
}
