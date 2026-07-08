export interface InstanciaAgenteItem {
  id: string;
  instanceId: string;
  personaId: string;
  personaNome: string;
  ativo: boolean;
}

export interface InstanciaAgenteFormData {
  instanceId: string;
  personaId: string;
}

export function validarInstanciaAgente(input: InstanciaAgenteFormData): {
  instanceId: string;
  personaId: string;
} {
  const instanceId = input.instanceId.trim();
  if (!instanceId) throw new Error("Instância é obrigatória.");
  if (!input.personaId) throw new Error("Persona é obrigatória.");
  return { instanceId, personaId: input.personaId };
}
