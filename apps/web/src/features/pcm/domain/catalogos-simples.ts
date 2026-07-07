export type CatalogoSimplesTipo =
  | "segmentos"
  | "palavras_chave"
  | "produto_categorias"
  | "equipamento_categorias";

export interface CatalogoSimplesItem {
  id: string;
  descricao: string;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface CatalogoSimplesFormData {
  descricao: string;
}

export function validarCatalogoSimples(input: CatalogoSimplesFormData): CatalogoSimplesFormData {
  const descricao = input.descricao.trim();
  if (!descricao) throw new Error("Descrição é obrigatória.");
  return { descricao };
}

export function labelCatalogoSimples(tipo: CatalogoSimplesTipo): string {
  const labels: Record<CatalogoSimplesTipo, string> = {
    segmentos: "Segmentos",
    palavras_chave: "Palavras-chave",
    produto_categorias: "Categorias de Produto",
    equipamento_categorias: "Categorias de Equipamento",
  };
  return labels[tipo];
}

export function campoCatalogoSimples(tipo: CatalogoSimplesTipo): "Descrição" | "Nome" {
  return tipo === "segmentos" || tipo === "palavras_chave" ? "Descrição" : "Nome";
}
