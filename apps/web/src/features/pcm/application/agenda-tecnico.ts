import { validarAlocacao } from "../domain/agenda-tecnico";
import type { AgendaTecnicoGateway } from "./agenda-tecnico-gateway";

export function listarSemanaAgenda(
  gateway: AgendaTecnicoGateway,
  inicioIso: string,
  fimIso: string,
) {
  return gateway.listarSemana(inicioIso, fimIso);
}

export function listarOpcoesAgenda(gateway: AgendaTecnicoGateway) {
  return Promise.all([gateway.listarFuncionarios(), gateway.listarClientes()]);
}

export function criarAlocacao(
  gateway: AgendaTecnicoGateway,
  input: Parameters<typeof validarAlocacao>[0],
  userId: string,
) {
  return gateway.criar(validarAlocacao(input), userId);
}

export function editarAlocacao(
  gateway: AgendaTecnicoGateway,
  id: string,
  input: Parameters<typeof validarAlocacao>[0],
  userId: string,
) {
  return gateway.editar(id, validarAlocacao(input), userId);
}

export function removerAlocacao(gateway: AgendaTecnicoGateway, id: string) {
  return gateway.remover(id);
}
