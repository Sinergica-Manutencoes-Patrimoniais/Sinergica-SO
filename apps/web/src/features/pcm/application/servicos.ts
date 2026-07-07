import { validarServico } from "../domain/servicos";
import type {
  DesativarServicoCommand,
  EditarServicoCommand,
  ServicoCommand,
  ServicosGateway,
} from "./servicos-gateway";

export function listarServicos(gateway: ServicosGateway) {
  return gateway.listar();
}

export function criarServico(gateway: ServicosGateway, input: ServicoCommand) {
  const validado = validarServico(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function editarServico(gateway: ServicosGateway, input: EditarServicoCommand) {
  const validado = validarServico(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function desativarServico(gateway: ServicosGateway, input: DesativarServicoCommand) {
  if (!input.id) throw new Error("Serviço é obrigatório.");
  return gateway.desativar(input);
}
