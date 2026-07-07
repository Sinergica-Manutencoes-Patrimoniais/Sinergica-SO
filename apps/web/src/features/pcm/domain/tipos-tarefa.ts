export interface TipoTarefa {
  id: string;
  nome: string;
  preencheRelato: boolean;
  exigeAssinatura: boolean;
  fotosMinimas: number;
  ativo: boolean;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface TipoTarefaFormData {
  nome: string;
  preencheRelato: boolean;
  exigeAssinatura: boolean;
  fotosMinimas: number;
  ativo?: boolean;
}

export function validarTipoTarefa(input: TipoTarefaFormData): TipoTarefaFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  if (!Number.isInteger(input.fotosMinimas) || input.fotosMinimas < 0) {
    throw new Error("Fotos mínimas deve ser um número inteiro maior ou igual a zero.");
  }

  return {
    nome,
    preencheRelato: input.preencheRelato,
    exigeAssinatura: input.exigeAssinatura,
    fotosMinimas: input.fotosMinimas,
    ativo: input.ativo ?? true,
  };
}

export function syncStatusLabel(status: string | null): string {
  if (status === "synced") return "Sincronizado";
  if (status === "failed" || status === "error") return "Falha";
  if (status === "pending") return "Pendente";
  return "Não sincronizado";
}
