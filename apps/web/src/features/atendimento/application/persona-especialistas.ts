import { validarEspecialista } from "../domain/operacao";
import type { EspecialistaFormData } from "../domain/operacao";
import type { OperacaoGateway } from "./operacao-gateway";

export async function listarEspecialistas(gateway: OperacaoGateway, personaId: string) {
  return gateway.listarEspecialistas(personaId);
}

export async function criarEspecialista(
  gateway: OperacaoGateway,
  input: EspecialistaFormData & { personaId: string; userId: string },
) {
  const validado = validarEspecialista(input);
  return gateway.criarEspecialista({
    ...validado,
    personaId: input.personaId,
    userId: input.userId,
  });
}

export async function desativarEspecialista(gateway: OperacaoGateway, id: string) {
  return gateway.desativarEspecialista(id);
}
