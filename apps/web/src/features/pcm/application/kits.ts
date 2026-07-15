import { validarAtribuirKit, validarKit } from "../domain/kits";
import type {
  AtribuirKitCommand,
  CriarKitCommand,
  DesativarKitCommand,
  DevolverKitCommand,
  EditarKitCommand,
  KitsGateway,
} from "./kits-gateway";

export function listarKits(gateway: KitsGateway) {
  return gateway.listarKits();
}

export function criarKit(gateway: KitsGateway, input: CriarKitCommand) {
  const validado = validarKit(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function editarKit(gateway: KitsGateway, input: EditarKitCommand) {
  const validado = validarKit(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function desativarKit(gateway: KitsGateway, input: DesativarKitCommand) {
  if (!input.id) throw new Error("Kit é obrigatório.");
  return gateway.desativar(input);
}

export function atribuirKit(gateway: KitsGateway, input: AtribuirKitCommand) {
  const validado = validarAtribuirKit(input);
  return gateway.atribuir({ ...validado, userId: input.userId });
}

export function devolverKit(gateway: KitsGateway, input: DevolverKitCommand) {
  return gateway.devolver(input);
}

export function listarAtribuicoesAtivasKit(gateway: KitsGateway) {
  return gateway.listarAtribuicoesAtivas();
}
