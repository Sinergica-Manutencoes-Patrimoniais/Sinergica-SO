import { validarCatalogoSimples } from "../domain/catalogos-simples";
import type {
  CatalogoSimplesCommand,
  CatalogosSimplesGateway,
  EditarCatalogoSimplesCommand,
  ExcluirCatalogoSimplesCommand,
} from "./catalogos-simples-gateway";

export function listarCatalogoSimples(
  gateway: CatalogosSimplesGateway,
  tipo: CatalogoSimplesCommand["tipo"],
) {
  return gateway.listar(tipo);
}

export function criarCatalogoSimples(
  gateway: CatalogosSimplesGateway,
  input: CatalogoSimplesCommand,
) {
  const validado = validarCatalogoSimples(input);
  return gateway.criar({ ...validado, tipo: input.tipo, userId: input.userId });
}

export function editarCatalogoSimples(
  gateway: CatalogosSimplesGateway,
  input: EditarCatalogoSimplesCommand,
) {
  const validado = validarCatalogoSimples(input);
  return gateway.editar({ ...validado, tipo: input.tipo, id: input.id, userId: input.userId });
}

export function excluirCatalogoSimples(
  gateway: CatalogosSimplesGateway,
  input: ExcluirCatalogoSimplesCommand,
) {
  if (!input.id) throw new Error("Registro é obrigatório.");
  return gateway.excluir(input);
}
