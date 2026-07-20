// domain/hierarquia.ts — Área e Local (árvore) — E01-S76.
// INV 1 (Local sem ciclo), INV 2 (área consistente na subárvore) e INV 7 (Área sempre presente)
// são also enforced no banco (trigger `fn_locais_valida_hierarquia`, FK not null de `area_id`);
// aqui validam ANTES do round-trip, pra UI dar erro imediato (mesmo padrão de `ferramentas.ts`).

export interface Area {
  id: string;
  clienteId: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

export interface AreaFormData {
  clienteId: string;
  nome: string;
  descricao?: string | null;
  ordem?: number;
}

/** Catálogo de Tipos de Local — cada cliente cadastra o seu (ex.: "Andar", "Sala", "Ambiente"),
 * na aba Estrutura. Local.tipoId sempre referencia um valor daqui — nunca texto livre (evita
 * divergência de escrita entre cadastros do mesmo cliente). */
export interface LocalTipo {
  id: string;
  clienteId: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface LocalTipoFormData {
  clienteId: string;
  nome: string;
  ordem?: number;
}

export interface Local {
  id: string;
  areaId: string;
  parentId: string | null;
  nome: string;
  tipoId: string | null;
  tipoNome: string | null;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

export interface LocalFormData {
  areaId: string;
  parentId?: string | null;
  nome: string;
  tipoId?: string | null;
  descricao?: string | null;
  ordem?: number;
}

export interface LocalArvoreNode extends Local {
  filhos: LocalArvoreNode[];
}

export function validarLocalTipo(input: LocalTipoFormData): LocalTipoFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do Tipo de Local é obrigatório.");
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  return { clienteId: input.clienteId, nome, ordem: input.ordem ?? 0 };
}

export function validarArea(input: AreaFormData): AreaFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome da Área é obrigatório.");
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  return {
    clienteId: input.clienteId,
    nome,
    descricao: textoOuNull(input.descricao),
    ordem: input.ordem ?? 0,
  };
}

/** INV 7 (Área sempre presente) é garantido aqui pelo `areaId` obrigatório — todo Local pertence a
 * uma Área, nunca é criado direto sob Cliente. */
export function validarLocal(input: LocalFormData): LocalFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do Local é obrigatório.");
  if (!input.areaId) throw new Error("Área é obrigatória.");
  return {
    areaId: input.areaId,
    parentId: input.parentId ?? null,
    nome,
    tipoId: textoOuNull(input.tipoId),
    descricao: textoOuNull(input.descricao),
    ordem: input.ordem ?? 0,
  };
}

/** INV 1 — um Local não pode ser ancestral de si mesmo. `locais` é a lista plana já carregada
 * (mesma Área ou não); percorre a cadeia de `parentId` a partir de `candidatoParentId` até achar
 * `localId` (ciclo) ou chegar à raiz. */
export function detectaCiclo(
  locais: Pick<Local, "id" | "parentId">[],
  localId: string,
  candidatoParentId: string | null,
): boolean {
  if (!candidatoParentId) return false;
  if (candidatoParentId === localId) return true;
  const porId = new Map(locais.map((l) => [l.id, l]));
  let cursor: string | null = candidatoParentId;
  let guard = 0;
  while (cursor) {
    if (cursor === localId) return true;
    guard += 1;
    if (guard > 100) return true; // profundidade excessiva — trata como ciclo (mesmo guard do trigger)
    cursor = porId.get(cursor)?.parentId ?? null;
  }
  return false;
}

/** INV 2 — se `local.parentId` está setado, o pai deve pertencer à mesma Área. */
export function areaConsistente(
  locais: Pick<Local, "id" | "areaId">[],
  areaId: string,
  parentId: string | null,
): boolean {
  if (!parentId) return true;
  const pai = locais.find((l) => l.id === parentId);
  return pai != null && pai.areaId === areaId;
}

/** Monta a árvore de Locais de uma Área a partir da lista plana (ordenada por `ordem`, depois
 * `nome`). Locais órfãos (parentId aponta pra um id fora da lista — não deveria acontecer, dado o
 * trigger, mas a UI não deve quebrar) viram raiz. */
export function montarArvore(locais: Local[]): LocalArvoreNode[] {
  const porId = new Map<string, LocalArvoreNode>(locais.map((l) => [l.id, { ...l, filhos: [] }]));
  const raizes: LocalArvoreNode[] = [];
  for (const local of porId.values()) {
    if (local.parentId && porId.has(local.parentId)) {
      porId.get(local.parentId)?.filhos.push(local);
    } else {
      raizes.push(local);
    }
  }
  const ordenar = (nodes: LocalArvoreNode[]) => {
    nodes.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    for (const node of nodes) ordenar(node.filhos);
  };
  ordenar(raizes);
  return raizes;
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
