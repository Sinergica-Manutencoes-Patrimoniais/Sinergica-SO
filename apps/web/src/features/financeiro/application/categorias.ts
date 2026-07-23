import { validarCategoria } from "../domain/categoria";
import type {
  CategoriaCommand,
  DesativarCategoriaCommand,
  EditarCategoriaCommand,
  FinanceiroGateway,
} from "./financeiro-gateway";

export function listarCategorias(gateway: FinanceiroGateway) {
  return gateway.listarCategorias();
}

export async function criarCategoria(gateway: FinanceiroGateway, input: CategoriaCommand) {
  const existentes = await gateway.listarCategorias();
  const validado = validarCategoria(input, existentes);
  return gateway.criarCategoria({ ...validado, userId: input.userId });
}

export async function editarCategoria(gateway: FinanceiroGateway, input: EditarCategoriaCommand) {
  const existentes = await gateway.listarCategorias();
  const validado = validarCategoria(
    input,
    existentes.filter((c) => c.id !== input.id),
  );
  return gateway.editarCategoria({ ...validado, id: input.id, userId: input.userId });
}

export function desativarCategoria(gateway: FinanceiroGateway, input: DesativarCategoriaCommand) {
  if (!input.id) throw new Error("Categoria é obrigatória.");
  return gateway.desativarCategoria(input);
}
