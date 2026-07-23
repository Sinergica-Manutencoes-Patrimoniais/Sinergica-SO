export type CategoriaTipo = "entrada" | "saida";

export interface CategoriaItem {
  id: string;
  nome: string;
  tipo: CategoriaTipo;
  parentId: string | null;
  ativo: boolean;
  seed: boolean;
}

export interface CategoriaFormData {
  nome: string;
  tipo: CategoriaTipo;
  parentId?: string | null;
}

/** Máx. 2 níveis: uma categoria só pode ter parent se o parent não tiver, ele mesmo, um parent
 * (domain.md — "máx. 2 níveis de categoria"). `categorias` é a lista carregada, usada para achar o
 * pai e checar a profundidade dele. */
export function validarCategoria(
  input: CategoriaFormData,
  categorias: CategoriaItem[],
): CategoriaFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");

  const parentId = input.parentId?.trim() || null;
  if (parentId) {
    const pai = categorias.find((c) => c.id === parentId);
    if (!pai) throw new Error("Categoria pai não encontrada.");
    if (pai.parentId) throw new Error("Categoria já é subcategoria — máximo de 2 níveis.");
    if (pai.tipo !== input.tipo) throw new Error("Subcategoria herda o tipo da categoria pai.");
  }

  return { nome, tipo: input.tipo, parentId };
}

export function categoriasRaiz(categorias: CategoriaItem[]): CategoriaItem[] {
  return categorias.filter((c) => !c.parentId);
}

export function subcategoriasDe(categorias: CategoriaItem[], parentId: string): CategoriaItem[] {
  return categorias.filter((c) => c.parentId === parentId);
}
