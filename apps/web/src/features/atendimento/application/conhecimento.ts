import { validarConhecimentoEntrada } from "../domain/conhecimento";
import type { ConhecimentoEntradaFormData } from "../domain/conhecimento";
import type { ConhecimentoGateway } from "./conhecimento-gateway";

export async function listarConhecimentoEntradas(gateway: ConhecimentoGateway) {
  return gateway.listarEntradas();
}

export async function criarConhecimentoEntrada(
  gateway: ConhecimentoGateway,
  input: ConhecimentoEntradaFormData & { userId: string },
) {
  const validado = validarConhecimentoEntrada(input);
  return gateway.criarEntrada({ ...validado, userId: input.userId });
}

export async function editarConhecimentoEntrada(
  gateway: ConhecimentoGateway,
  input: ConhecimentoEntradaFormData & { id: string; userId: string },
) {
  const validado = validarConhecimentoEntrada(input);
  return gateway.editarEntrada({ ...validado, id: input.id, userId: input.userId });
}

export async function desativarConhecimentoEntrada(gateway: ConhecimentoGateway, id: string) {
  return gateway.desativarEntrada(id);
}
