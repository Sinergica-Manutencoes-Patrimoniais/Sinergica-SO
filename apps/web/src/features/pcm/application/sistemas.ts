import {
  validarMembroMesmoCliente,
  validarMembroNaoDuplicado,
  validarSistema,
} from "../domain/sistemas";
import type { EditarSistemaCommand, SistemaCommand, SistemasGateway } from "./sistemas-gateway";

export function listarSistemas(gateway: SistemasGateway, clienteId?: string) {
  return gateway.listar(clienteId);
}

export function obterSistema(gateway: SistemasGateway, id: string) {
  return gateway.obter(id);
}

/** AC-7/AC-8 — persiste em pcm.sistemas; o trigger `trg_sistemas_auvo_enqueue` (banco) enfileira no
 * outbox automaticamente — nenhuma chamada Auvo acontece aqui (drain é assíncrono e gated por
 * `writeEnabled:false` no descriptor). */
export function criarSistema(gateway: SistemasGateway, input: SistemaCommand) {
  const validado = validarSistema(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function editarSistema(gateway: SistemasGateway, input: EditarSistemaCommand) {
  const validado = validarSistema(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function desativarSistema(gateway: SistemasGateway, id: string, userId: string) {
  if (!id) throw new Error("Sistema é obrigatório.");
  return gateway.desativar(id, userId);
}

export function listarItensDisponiveis(gateway: SistemasGateway, clienteId: string) {
  return gateway.listarItensDisponiveis(clienteId);
}

export function listarItensDoSistema(gateway: SistemasGateway, sistemaId: string) {
  return gateway.listarItensDoSistema(sistemaId);
}

/** AC-7 — adiciona N itens ao Sistema; um Item pode entrar em >1 Sistema (INV-6 só impede
 * duplicata NO MESMO Sistema). Valida INV-5 (mesmo cliente) e INV-6 antes do round-trip. */
export async function adicionarItem(
  gateway: SistemasGateway,
  sistemaId: string,
  itemId: string,
  userId: string,
) {
  const sistema = await gateway.obter(sistemaId);
  if (!sistema) throw new Error("Sistema não encontrado.");
  const [itens, membrosAtuais] = await Promise.all([
    gateway.listarItensDisponiveis(sistema.clienteId),
    gateway.listarItensDoSistema(sistemaId),
  ]);
  const item = itens.find((i) => i.id === itemId);
  validarMembroMesmoCliente(sistema.clienteId, item?.clientId ?? null);
  validarMembroNaoDuplicado(membrosAtuais, itemId);
  return gateway.adicionarItem(sistemaId, itemId, userId);
}

export function removerItem(gateway: SistemasGateway, sistemaId: string, itemId: string) {
  return gateway.removerItem(sistemaId, itemId);
}
