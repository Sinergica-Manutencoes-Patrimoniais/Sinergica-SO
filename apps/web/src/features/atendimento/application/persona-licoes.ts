import { validarLicao } from "../domain/operacao";
import type { LicaoFormData } from "../domain/operacao";
import type { OperacaoGateway } from "./operacao-gateway";

export async function listarLicoes(gateway: OperacaoGateway, personaId: string) {
  return gateway.listarLicoes(personaId);
}

export async function criarLicao(
  gateway: OperacaoGateway,
  input: LicaoFormData & { personaId: string; userId: string },
) {
  const validado = validarLicao(input);
  return gateway.criarLicao({ ...validado, personaId: input.personaId, userId: input.userId });
}

export async function desativarLicao(gateway: OperacaoGateway, id: string) {
  return gateway.desativarLicao(id);
}
