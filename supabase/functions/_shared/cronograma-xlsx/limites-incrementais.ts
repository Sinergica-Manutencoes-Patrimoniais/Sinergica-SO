/** Limites por parte XML; não são limites de CPU nem isolamento de processo. */
export function criarLimiteEstruturalXml() {
  let elementos = 0;
  return (profundidade: number) => {
    if (profundidade >= 128 || ++elementos > 2_000_000) throw new Error("Estrutura XML excede limites.");
  };
}

const encoderUtf8 = new TextEncoder();
const blocoUtf8 = new Uint8Array(4096);

/** Mede UTF-8 sem criar cópia proporcional ao texto, inclusive pares substitutos. */
export function excedeLimiteUtf8(texto: string, limite: number): boolean {
  let posicao = 0;
  let total = 0;
  while (posicao < texto.length) {
    // Limitar também a substring: algumas engines copiam slices e reter o
    // restante inteiro a cada iteração pode multiplicar o uso de memória.
    let fim = Math.min(posicao + 2048, texto.length);
    const ultimo = texto.charCodeAt(fim - 1);
    const seguinte = texto.charCodeAt(fim);
    if (ultimo >= 0xd800 && ultimo <= 0xdbff && seguinte >= 0xdc00 && seguinte <= 0xdfff) fim++;
    const { read, written } = encoderUtf8.encodeInto(texto.slice(posicao, fim), blocoUtf8);
    if (!read) throw new Error("Não foi possível medir texto UTF-8.");
    total += written;
    if (total > limite) return true;
    posicao += read;
  }
  return false;
}
