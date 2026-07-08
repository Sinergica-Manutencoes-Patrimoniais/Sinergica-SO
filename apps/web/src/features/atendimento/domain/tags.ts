export interface TagItem {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface TagFormData {
  nome: string;
}

export function validarTag(input: TagFormData): TagFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome da tag é obrigatório.");
  return { nome };
}
