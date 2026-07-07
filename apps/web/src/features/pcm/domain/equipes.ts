export interface EquipeItem {
  id: string;
  nome: string;
  participantesAuvoIds: number[];
  gestoresAuvoIds: number[];
  participantesNomes: string[];
  gestoresNomes: string[];
  ativo: boolean;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
}

export interface EquipeFuncionarioOpcao {
  id: string;
  nome: string;
  auvoUserId: number | null;
}

export interface EquipeFormData {
  nome: string;
  participanteIds: string[];
  gestorIds: string[];
}

export function validarEquipe(
  input: EquipeFormData,
  funcionarios: EquipeFuncionarioOpcao[] = [],
): EquipeFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  const ids = new Set(funcionarios.map((item) => item.id));
  for (const id of [...input.participanteIds, ...input.gestorIds]) {
    if (!ids.has(id)) throw new Error("Técnico inválido.");
  }
  for (const funcionario of funcionarios.filter(
    (item) => input.participanteIds.includes(item.id) || input.gestorIds.includes(item.id),
  )) {
    if (!funcionario.auvoUserId)
      throw new Error("Sincronize todos os técnicos com o Auvo antes de criar a equipe.");
  }
  return {
    nome,
    participanteIds: [...new Set(input.participanteIds)],
    gestorIds: [...new Set(input.gestorIds)],
  };
}
