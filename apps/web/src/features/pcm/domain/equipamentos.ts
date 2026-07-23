/** E01-S76: "equipamento"|"componente" — o conceito vira "Item" na UI/domínio (ADR-0009); o nome
 * físico da tabela/adapter (`equipamentos`) foi preservado para não quebrar o pipeline Auvo. */
export type ItemTipo = "equipamento" | "componente";

export interface EquipamentoItem {
  id: string;
  nome: string;
  identificador: string | null;
  categoria: string | null;
  clientId: string | null;
  clienteNome: string | null;
  auvoCustomerId: number | null;
  localizacao: string | null;
  observacoes: string | null;
  ativo: boolean;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
  urlImagem: string | null;
  uriAnexos: string[];
  // E01-S76
  localId: string | null;
  tipo: ItemTipo;
  parentItemId: string | null;
}

/** E01-S76 AC-6: caminho de instalação (Cliente>Área>Local) + Sistemas de que o Item participa —
 * resolvido pela infra (`obterContextoItem`), consumido pela tela de Detalhe do Item. */
export interface ItemContexto {
  item: EquipamentoItem;
  breadcrumb: {
    clienteNome: string | null;
    areaNome: string | null;
    localNome: string | null;
  } | null;
  sistemas: Array<{ id: string; nome: string; codigo: string | null }>;
  componentesFilhos: EquipamentoItem[];
}

export interface EquipamentoClienteOpcao {
  id: string;
  nome: string;
  auvoId: number | null;
}

export interface EquipamentoFormData {
  nome: string;
  identificador?: string | null;
  categoria?: string | null;
  clientId?: string | null;
  localizacao?: string | null;
  observacoes?: string | null;
  // E01-S76
  localId?: string | null;
  tipo?: ItemTipo;
  parentItemId?: string | null;
}

export function validarEquipamento(input: EquipamentoFormData): EquipamentoFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  const tipo = input.tipo ?? "equipamento";
  if (tipo !== "equipamento" && tipo !== "componente") {
    throw new Error("Tipo deve ser 'equipamento' ou 'componente'.");
  }
  return {
    nome,
    identificador: textoOuNull(input.identificador),
    categoria: textoOuNull(input.categoria),
    clientId: textoOuNull(input.clientId),
    localizacao: textoOuNull(input.localizacao),
    observacoes: textoOuNull(input.observacoes),
    localId: textoOuNull(input.localId),
    tipo,
    parentItemId: textoOuNull(input.parentItemId),
  };
}

/** AC-5 — Componente filho de Equipamento: o pai deve pertencer ao mesmo cliente (INV 4 do
 * domain.md). Recomendado (não bloqueante): pai é do tipo 'equipamento'. */
export function validarParentItem(
  itemClientId: string | null,
  pai: Pick<EquipamentoItem, "clientId" | "tipo"> | null,
) {
  if (!pai) return;
  if (pai.clientId !== itemClientId) {
    throw new Error("O Equipamento pai deve pertencer ao mesmo cliente.");
  }
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
