// memoria-cliente.ts — E02-S24. Composição do contexto de memória/alma por cliente — pura, sem
// I/O. Quem busca alma/resumo (por `clienteId`) é responsabilidade do chamador; isolamento entre
// clientes (AC-4) é garantido por nunca misturar dados de dois `clienteId` numa mesma chamada.

/** AC-1: uma só string, pronta pra entrar no bloco de conhecimento do prompt (`comporPromptPersona`).
 * Alma vazia/ausente e resumo vazio/ausente não geram seção — evita ruído no prompt pra cliente
 * novo sem histórico. */
export function comporContextoCliente(
  alma: string | null | undefined,
  resumo: string | null | undefined,
): string | null {
  const partes: string[] = [];
  const almaTrim = alma?.trim();
  if (almaTrim) partes.push(`Sobre este cliente: ${almaTrim}`);
  const resumoTrim = resumo?.trim();
  if (resumoTrim) partes.push(`Resumo das conversas anteriores: ${resumoTrim}`);
  return partes.length > 0 ? partes.join("\n\n") : null;
}
