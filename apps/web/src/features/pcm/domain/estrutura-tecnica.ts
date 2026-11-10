/** Um grupo representa unidades homogêneas em um Local, sem TAG individual por unidade. */
export interface GrupoQuantitativoInput {
  clienteId: string;
  localId: string;
  categoriaId: string;
  nome: string;
  quantidade: number;
  caracteristicas: Record<string, string>;
}

export function validarGrupoQuantitativo(input: GrupoQuantitativoInput): GrupoQuantitativoInput {
  const clienteId = input.clienteId.trim();
  const localId = input.localId.trim();
  const categoriaId = input.categoriaId.trim();
  const nome = input.nome.trim();
  if (!clienteId || !localId || !categoriaId || !nome) {
    throw new Error("Informe Cliente, Local, categoria e nome do grupo.");
  }
  if (!Number.isSafeInteger(input.quantidade) || input.quantidade <= 0) {
    throw new Error("A quantidade deve ser um número inteiro positivo.");
  }
  return {
    ...input,
    clienteId,
    localId,
    categoriaId,
    nome,
    caracteristicas: { ...input.caracteristicas },
  };
}
