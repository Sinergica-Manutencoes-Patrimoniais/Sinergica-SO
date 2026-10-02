export type EstadoFalhaEnvioPreventiva = "falha" | "incerto";

/**
 * Só falha conhecida antes do efeito remoto é repetível. Depois de iniciar POST/PATCH/GET no
 * Auvo, timeout ou resposta incompleta podem ter criado a task: reconciliação obrigatória.
 */
export function classificarFalhaEnvioPreventiva(
  tentativaRemotaIniciada: boolean,
  rejeicaoRemotaConhecida: boolean,
): EstadoFalhaEnvioPreventiva {
  if (!tentativaRemotaIniciada || rejeicaoRemotaConhecida) return "falha";
  return "incerto";
}
