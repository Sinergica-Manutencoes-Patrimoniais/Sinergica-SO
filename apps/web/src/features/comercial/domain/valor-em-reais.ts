/** Interpreta moeda pt-BR sem arredondar nem usar ponto flutuante. */
export function valorReaisParaCentavos(valor: string, limite = 1_000_000_000_000): number | null {
  const texto = valor.trim();
  if (texto.length > 24 || !/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(texto) || !Number.isSafeInteger(limite) || limite < 0) return null;
  const [inteiro = "", decimal = ""] = texto.split(",");
  const centavos = BigInt(inteiro.replace(/\./g, "")) * 100n + BigInt(decimal.padEnd(2, "0") || "0");
  return centavos <= BigInt(limite) ? Number(centavos) : null;
}

/** Entrada legível correspondente a centavos já calculados pelo servidor ou domínio. */
export function centavosParaEntradaReais(centavos: string): string {
  if (!/^(?:0|[1-9]\d*)$/.test(centavos)) throw new Error("Centavos inválidos.");
  const valor = BigInt(centavos);
  return `${valor / 100n},${(valor % 100n).toString().padStart(2, "0")}`;
}
