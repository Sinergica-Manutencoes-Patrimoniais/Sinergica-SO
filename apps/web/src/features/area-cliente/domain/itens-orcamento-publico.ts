/** Defesa de UI; sigilo e autorização devem ser garantidos na origem, antes da resposta HTTP. */
export function projetarItensOrcamentoPublico(
  itens: unknown,
): Array<{ descricao?: string; quantidade?: number }> {
  if (!Array.isArray(itens)) return [];
  return itens.map((item: unknown) => {
    const registro =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    return {
      ...(typeof registro.descricao === "string" ? { descricao: registro.descricao } : {}),
      ...(typeof registro.quantidade === "number" && Number.isFinite(registro.quantidade)
        ? { quantidade: registro.quantidade }
        : {}),
    };
  });
}
