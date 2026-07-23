export type EvolutionStatus = "conectado" | "desconectado" | "erro";

export interface EvolutionInstancia {
  id: string;
  label: string;
  instanceName: string;
  numeroVinculado: string | null;
  status: EvolutionStatus;
  webhookRegistrado: boolean;
  ativo: boolean;
  erro: string | null;
}

export interface EvolutionCriarForm {
  label: string;
  instanceName: string;
}

export interface EvolutionCriarValidado {
  label: string;
  instanceName: string;
}

export interface EvolutionAcaoResultado {
  instancia: EvolutionInstancia;
  qrCode: string | null;
}

export function validarEvolutionCriar(input: EvolutionCriarForm): EvolutionCriarValidado {
  const label = input.label.trim();
  const instanceName = input.instanceName.trim();
  if (!label) throw new Error("Nome da conexão é obrigatório.");
  if (!instanceName) throw new Error("Instance ID é obrigatório.");
  if (!/^[A-Za-z0-9_-]+$/.test(instanceName)) {
    throw new Error("Instance ID aceita apenas letras, números, hífen e underscore.");
  }
  return { label, instanceName };
}
