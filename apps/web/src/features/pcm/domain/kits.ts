export interface KitComposicaoItem {
  ferramentaId: string;
  ferramentaNome: string;
  quantidade: number;
}

export interface KitItem {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  itens: KitComposicaoItem[];
}

export interface KitFormData {
  nome: string;
  descricao?: string | null;
  itens: Array<{ ferramentaId: string; quantidade: number }>;
}

export interface AtribuirKitFormData {
  kitId: string;
  funcionarioId: string;
}

export interface DevolverKitFormData {
  kitAtribuicaoId: string;
  condicao?: "ok" | "danificada" | "perdida";
}

/** Um evento de atribuição de kit (várias unidades, 1 `kit_atribuicao_id` comum) — AC-4: pode
 * ficar "incompleto" se 1 unidade foi devolvida/baixada isolada fora do fluxo de kit. */
export interface KitAtribuicaoAtiva {
  kitAtribuicaoId: string;
  funcionarioId: string;
  funcionarioNome: string;
  totalItens: number;
  itensAindaComTecnico: number;
  unidades: Array<{ id: string; codigo: string; ferramentaNome: string; status: string }>;
}

export function validarKit(input: KitFormData): KitFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do kit é obrigatório.");
  if (input.itens.length === 0) throw new Error("Kit precisa de pelo menos 1 item.");
  const ferramentasVistas = new Set<string>();
  for (const item of input.itens) {
    if (!item.ferramentaId) throw new Error("Selecione a ferramenta de cada item.");
    if (ferramentasVistas.has(item.ferramentaId)) {
      throw new Error("Cada ferramenta só pode aparecer 1 vez no kit.");
    }
    ferramentasVistas.add(item.ferramentaId);
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
      throw new Error("Quantidade de cada item deve ser um número inteiro maior que zero.");
    }
  }
  return { nome, descricao: textoOuNull(input.descricao), itens: input.itens };
}

export function validarAtribuirKit(input: AtribuirKitFormData): AtribuirKitFormData {
  if (!input.kitId) throw new Error("Kit é obrigatório.");
  if (!input.funcionarioId) throw new Error("Técnico é obrigatório.");
  return input;
}

/** AC-1: "completo agora" = há unidades DISPONÍVEIS suficientes de CADA item do kit neste
 * instante — puramente informativo, a garantia real de tudo-ou-nada é a transação no banco
 * (`fn_atribuir_kit`). */
export function kitEstaCompleto(
  itens: KitComposicaoItem[],
  unidadesDisponiveisPorFerramenta: Map<string, number>,
): boolean {
  return itens.every(
    (item) => (unidadesDisponiveisPorFerramenta.get(item.ferramentaId) ?? 0) >= item.quantidade,
  );
}

export function itensFaltantes(
  itens: KitComposicaoItem[],
  unidadesDisponiveisPorFerramenta: Map<string, number>,
): KitComposicaoItem[] {
  return itens.filter(
    (item) => (unidadesDisponiveisPorFerramenta.get(item.ferramentaId) ?? 0) < item.quantidade,
  );
}

/** AC-4: kit atribuído fica "incompleto com o técnico" quando 1+ unidade saiu do grupo (devolvida/
 * baixada isolada) sem passar pelo fluxo de devolução de kit inteiro. */
export function kitAtribuicaoEstaCompleta(atribuicao: KitAtribuicaoAtiva): boolean {
  return atribuicao.itensAindaComTecnico >= atribuicao.totalItens;
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
