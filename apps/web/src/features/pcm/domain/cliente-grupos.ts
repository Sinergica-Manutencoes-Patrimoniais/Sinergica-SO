export interface ClienteGrupoItem {
  id: string;
  nome: string;
  clienteIds: string[];
  clientesAuvoIds: number[];
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface ClienteGrupoFormData {
  nome: string;
  clienteIds: string[];
}

export function validarClienteGrupo(input: ClienteGrupoFormData): ClienteGrupoFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  const clienteIds = Array.from(new Set(input.clienteIds.filter(Boolean)));
  if (clienteIds.length === 0) throw new Error("Selecione ao menos um cliente sincronizado.");
  return { nome, clienteIds };
}
