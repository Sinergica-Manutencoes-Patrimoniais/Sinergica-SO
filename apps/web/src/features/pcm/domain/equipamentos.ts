export interface EquipamentoItem {
  id: string;
  nome: string;
  identificador: string | null;
  categoria: string | null;
  clientId: string | null;
  clienteNome: string | null;
  auvoCustomerId: number | null;
  localizacao: string | null;
  observacoes: string | null;
  ativo: boolean;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface EquipamentoClienteOpcao {
  id: string;
  nome: string;
  auvoId: number | null;
}

export interface EquipamentoFormData {
  nome: string;
  identificador?: string | null;
  categoria?: string | null;
  clientId?: string | null;
  localizacao?: string | null;
  observacoes?: string | null;
}

export function validarEquipamento(input: EquipamentoFormData): EquipamentoFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  return {
    nome,
    identificador: textoOuNull(input.identificador),
    categoria: textoOuNull(input.categoria),
    clientId: textoOuNull(input.clientId),
    localizacao: textoOuNull(input.localizacao),
    observacoes: textoOuNull(input.observacoes),
  };
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
