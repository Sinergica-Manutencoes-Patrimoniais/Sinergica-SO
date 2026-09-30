// domain/sistemas.ts — Sistema (agrupamento funcional transversal de Itens) — E01-S76.
// INV 5 (membro mesmo cliente do Sistema) e INV 6 (unique sistema_id+item_id) — INV 6 também é
// unique index no banco (uq_sistema_item); aqui valida antes do round-trip.

export interface Sistema {
  id: string;
  clienteId: string;
  areaId: string | null;
  /** E01-S155: quando presente, `areaId` é sempre a Área deste Local (o banco deriva). */
  localId: string | null;
  nome: string;
  categoriaId: string | null;
  categoria: string | null;
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
  localId?: string | null;
  nome: string;
  codigo?: string | null;
  alterarIdentificador?: boolean;
  categoriaId?: string | null;
  categoria?: string | null;
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
  const categoriaId = textoOuNull(input.categoriaId);
  if (!categoriaId) throw new Error("Categoria é obrigatória.");
  return {
    clienteId: input.clienteId,
    areaId: textoOuNull(input.areaId),
    localId: textoOuNull(input.localId),
    nome,
    codigo: textoOuNull(input.codigo),
    alterarIdentificador: input.alterarIdentificador === true,
    categoriaId,
    categoria: textoOuNull(input.categoria),
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

/** E01-S154 AC-4 — Componente pertence a no máximo 1 Sistema (`uq_sistema_itens_item_unico` no
 * banco). `pertencimento` é o Sistema ao qual o item já pertence hoje, se algum. */
export function validarMembroSemOutroSistema(
  sistemaAtualId: string,
  pertencimento: { sistemaId: string; sistemaNome: string } | null,
) {
  if (pertencimento && pertencimento.sistemaId !== sistemaAtualId) {
    throw new Error(
      `Componente já pertence ao Sistema «${pertencimento.sistemaNome}». Remova de lá antes.`,
    );
  }
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
