export interface ConhecimentoEntradaItem {
  id: string;
  personaId: string | null;
  titulo: string;
  conteudo: string;
  categoria: string;
  tags: string[];
  prioridade: number;
  ativo: boolean;
}

export interface ConhecimentoEntradaFormData {
  personaId: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  tags: string[];
  prioridade: number;
}

export interface ConhecimentoEntradaValidado {
  personaId: string | null;
  titulo: string;
  conteudo: string;
  categoria: string;
  tags: string[];
  prioridade: number;
}

export function validarConhecimentoEntrada(
  input: ConhecimentoEntradaFormData,
): ConhecimentoEntradaValidado {
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error("Título é obrigatório.");
  const conteudo = input.conteudo.trim();
  if (!conteudo) throw new Error("Conteúdo é obrigatório.");
  if (input.prioridade < 1 || input.prioridade > 10)
    throw new Error("Prioridade deve estar entre 1 e 10.");
  return {
    personaId: input.personaId || null,
    titulo,
    conteudo,
    categoria: input.categoria.trim() || "geral",
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    prioridade: input.prioridade,
  };
}
