import { validarMarcacao } from "../domain/marcacoes-cliente";
import type {
  CriarMarcacaoCommand,
  EditarMarcacaoCommand,
  MarcacoesClienteGateway,
} from "./marcacoes-cliente-gateway";

export function listarMarcacoes(gateway: MarcacoesClienteGateway) {
  return gateway.listar();
}

export async function criarMarcacao(gateway: MarcacoesClienteGateway, input: CriarMarcacaoCommand) {
  const validado = validarMarcacao(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export async function editarMarcacao(
  gateway: MarcacoesClienteGateway,
  input: EditarMarcacaoCommand,
) {
  if (!input.id) throw new Error("Marcação é obrigatória.");
  const validado = validarMarcacao(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export async function excluirMarcacao(gateway: MarcacoesClienteGateway, id: string) {
  if (!id) throw new Error("Marcação é obrigatória.");
  return gateway.excluir(id);
}

export async function definirMarcacaoCliente(
  gateway: MarcacoesClienteGateway,
  clienteId: string,
  marcacaoId: string | null,
  userId: string,
) {
  if (!clienteId) throw new Error("Cliente é obrigatório.");
  return gateway.definirMarcacaoCliente(clienteId, marcacaoId, userId);
}
