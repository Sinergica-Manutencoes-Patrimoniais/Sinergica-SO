// Conversão R$↔centavos por parse de string — nunca float × 100 (design.md D-1/E04-S01 task 3).
// Mesma regra de pcm/domain/servicos.ts; duplicada aqui porque features de domínios diferentes
// não se importam entre si (CLAUDE.md — regra de dependência DDD tático).

export function reaisParaCentavos(value: string): number {
  const normalizado = value.trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero * 100);
}

export function centavosParaReais(value: number): string {
  return (value / 100).toFixed(2).replace(".", ",");
}

// DEF-47: o resultado (entradas − saídas) é um valor com sinal. Exibi-lo pelo módulo,
// deixando a cor como único indicador de negativo, esconde o sinal de quem não distingue
// cor e faz o cartão "Resultado" parecer um saldo positivo. O sinal vai no texto.
export function centavosParaReaisComSinal(value: number): string {
  const sinal = value < 0 ? "-" : "";
  return `${sinal}${centavosParaReais(Math.abs(value))}`;
}
