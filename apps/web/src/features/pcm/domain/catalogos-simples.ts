export type CatalogoSimplesTipo =
  | "segmentos"
  | "palavras_chave"
  | "produto_categorias"
  | "equipamento_categorias";

export interface CatalogoSimplesItem {
  id: string;
  descricao: string;
  sigla: string | null;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface CatalogoSimplesFormData {
  descricao: string;
  sigla?: string | null;
}

export function validarCatalogoSimples(input: CatalogoSimplesFormData): CatalogoSimplesFormData {
  const descricao = input.descricao.trim();
  if (!descricao) throw new Error("Descrição é obrigatória.");
  const sigla = input.sigla?.trim().toUpperCase();
  if (sigla && !/^[A-Z0-9]{3}$/.test(sigla)) {
    throw new Error("Sigla deve ter exatamente 3 letras ou números.");
  }
  return sigla ? { descricao, sigla } : { descricao };
}

export function labelCatalogoSimples(tipo: CatalogoSimplesTipo): string {
  const labels: Record<CatalogoSimplesTipo, string> = {
    segmentos: "Segmentos",
    palavras_chave: "Palavras-chave",
    produto_categorias: "Categorias de Produto",
    equipamento_categorias: "Categorias de Ativo",
  };
  return labels[tipo];
}

export function campoCatalogoSimples(tipo: CatalogoSimplesTipo): "Descrição" | "Nome" {
  return tipo === "segmentos" || tipo === "palavras_chave" ? "Descrição" : "Nome";
}
