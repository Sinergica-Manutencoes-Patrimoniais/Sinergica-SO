// domain/siglas.ts — E01-S156/E01-S157: sigla de 3 caracteres [A-Z0-9] para Cliente, Área, Local
// e Categoria, e sugestão do bloco "nome" do identificador de ativo (ADR-0022). Algoritmo
// determinístico — ver specs/E01-S155-posicao-flexivel-ativos/design.md ("Algoritmo de sigla").

const STOPWORDS = new Set([
  "DE",
  "DA",
  "DO",
  "DAS",
  "DOS",
  "E",
  "EM",
  "NA",
  "NO",
  "NAS",
  "NOS",
  "A",
  "O",
  "AS",
  "OS",
  "PARA",
  "COM",
  "POR",
]);

const ALFABETO_DESEMPATE = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

export interface SugestaoSigla {
  sigla: string;
  /** Número extraído do fim do nome (ex.: "Ar Condicionado 2" → "02"). Só preenchido quando
   * `manterNumero: false` — para Cliente/Área/Local/Categoria o número fica embutido na sigla. */
  numeroFinal: string | null;
}

function normalizarTexto(nome: string): string {
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: remove marcas de combinação (acento) do normalize("NFD"), mesmo padrão já usado no repo.
  const semDiacritico = nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const semAcento = semDiacritico.replace(/[°ºª]/g, "").toUpperCase();
  return semAcento.replace(/[^A-Z0-9]/g, " ");
}

function tokenizar(nome: string): string[] {
  return normalizarTexto(nome)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

interface TokensClassificados {
  palavras: string[];
  marcador: string | null;
  numero: string | null;
}

/** Remove stopwords, exceto um token de 1 caractere que vem depois de outro token já mantido —
 * esse é um marcador (ex.: o "A" de "Torre A"), não uma stopword, mesmo estando na lista. */
function classificarTokens(tokens: string[]): TokensClassificados {
  const semStopword: string[] = [];
  for (const token of tokens) {
    const marcadorProtegido = token.length === 1 && semStopword.length > 0;
    if (STOPWORDS.has(token) && !marcadorProtegido) continue;
    semStopword.push(token);
  }
  const base = semStopword.length > 0 ? semStopword : tokens;

  let numero: string | null = null;
  const semNumero: string[] = [];
  for (let i = base.length - 1; i >= 0; i--) {
    if (numero === null && /^[0-9]+$/.test(base[i])) {
      numero = base[i];
    } else {
      semNumero.unshift(base[i]);
    }
  }

  let marcador: string | null = null;
  let palavras = semNumero;
  if (semNumero.length >= 2 && semNumero[semNumero.length - 1].length === 1) {
    marcador = semNumero[semNumero.length - 1];
    palavras = semNumero.slice(0, -1);
  }

  return { palavras, marcador, numero };
}

function pad(base: string, tamanho: number): string {
  return base.padEnd(tamanho, "X").slice(0, tamanho);
}

/** Usado dentro da sigla (regra a) — sigla tem 3 caracteres, então número ≥3 dígitos é truncado
 * aos 2 últimos. Não confundir com `formatarNumeroFinal`, que não trunca. */
function formatarNumeroParaSigla(numero: string): string {
  return numero.length >= 3 ? numero.slice(-2) : numero.padStart(2, "0");
}

function formatarNumeroParaSiglaDeTresDigitos(numero: string): string {
  return numero.length >= 3 ? numero.slice(-3) : numero.padStart(3, "0");
}

/** `numeroFinal` é o sequencial do identificador (E01-S157) — nunca truncado, só preenchido com
 * zero à esquerda quando tem 1 ou 2 dígitos. */
function formatarNumeroFinal(numero: string): string {
  return numero.length <= 2 ? numero.padStart(2, "0") : numero;
}

export function sugerirSigla(nome: string, opcoes: { manterNumero: boolean }): SugestaoSigla {
  const tokens = tokenizar(nome);
  if (tokens.length === 0) {
    throw new Error("Nome vazio ou sem caracteres válidos para gerar sigla.");
  }
  const { palavras, marcador, numero } = classificarTokens(tokens);
  const numeroFinal = !opcoes.manterNumero && numero !== null ? formatarNumeroFinal(numero) : null;

  if (opcoes.manterNumero && numero !== null && palavras.length >= 1) {
    return { sigla: palavras[0].charAt(0) + formatarNumeroParaSigla(numero), numeroFinal };
  }
  if (marcador !== null && palavras.length === 1) {
    return { sigla: pad(palavras[0].slice(0, 2), 2) + marcador, numeroFinal };
  }
  if (palavras.length >= 3) {
    return {
      sigla: palavras[0].charAt(0) + palavras[1].charAt(0) + palavras[2].charAt(0),
      numeroFinal,
    };
  }
  if (palavras.length === 2) {
    return { sigla: pad(palavras[0].slice(0, 2), 2) + palavras[1].charAt(0), numeroFinal };
  }
  if (palavras.length === 1) {
    return { sigla: pad(palavras[0].slice(0, 3), 3), numeroFinal };
  }
  if (numero !== null) {
    return { sigla: formatarNumeroParaSiglaDeTresDigitos(numero), numeroFinal };
  }
  throw new Error("Não foi possível gerar sigla a partir do nome.");
}

/** Sigla determinística de `sugerirSigla`, ajustada pra não colidir com `emUso`: mantém os 2
 * primeiros caracteres e varia o 3º pelo alfabeto de desempate (sem 0/1/I/O, que confundem em
 * etiqueta impressa). */
export function sugerirSiglaUnica(
  nome: string,
  emUso: ReadonlySet<string>,
  opcoes: { manterNumero: boolean },
): string {
  const { sigla } = sugerirSigla(nome, opcoes);
  if (!emUso.has(sigla)) return sigla;
  const prefixo = sigla.slice(0, 2);
  for (const letra of ALFABETO_DESEMPATE) {
    const candidata = prefixo + letra;
    if (!emUso.has(candidata)) return candidata;
  }
  throw new Error("Não foi possível sugerir sigla única — informe manualmente.");
}

export function validarSigla(valor: string): string {
  const normalizado = valor.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(normalizado)) {
    throw new Error("Sigla deve ter exatamente 3 letras ou números.");
  }
  return normalizado;
}
