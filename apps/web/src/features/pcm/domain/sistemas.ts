// domain/sistemas.ts — Sistema (agrupamento funcional transversal de Itens) — E01-S76.
// INV 5 (membro mesmo cliente do Sistema) e INV 6 (unique sistema_id+item_id) — INV 6 também é
// unique index no banco (uq_sistema_item); aqui valida antes do round-trip.

export interface Sistema {
  id: string;
  clienteId: string;
  areaId: string | null;
  nome: string;
  tipo: string | null;
  descricao: string | null;
  ativo: boolean;
  auvoId: number | null;
  auvoEquipmentId: number | null;
  codigo: string | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface SistemaFormData {
  clienteId: string;
  areaId?: string | null;
  nome: string;
  tipo?: string | null;
  descricao?: string | null;
}

export interface SistemaItemMembro {
  id: string;
  sistemaId: string;
  itemId: string;
  itemNome: string;
  itemClienteId: string;
}

export function validarSistema(input: SistemaFormData): SistemaFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do Sistema é obrigatório.");
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  return {
    clienteId: input.clienteId,
    areaId: textoOuNull(input.areaId),
    nome,
    tipo: textoOuNull(input.tipo),
    descricao: textoOuNull(input.descricao),
  };
}

/** INV 5 — todo Item em `sistema_itens` deve pertencer ao `clienteId` do Sistema. */
export function validarMembroMesmoCliente(sistemaClienteId: string, itemClienteId: string | null) {
  if (itemClienteId !== sistemaClienteId) {
    throw new Error("Item deve pertencer ao mesmo cliente do Sistema.");
  }
}

/** INV 6 — um Item não pode ser adicionado duas vezes ao mesmo Sistema (unique sistema_id+item_id
 * também garantido no banco). */
export function validarMembroNaoDuplicado(
  membrosAtuais: Pick<SistemaItemMembro, "itemId">[],
  itemId: string,
) {
  if (membrosAtuais.some((m) => m.itemId === itemId)) {
    throw new Error("Este item já faz parte do Sistema.");
  }
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
