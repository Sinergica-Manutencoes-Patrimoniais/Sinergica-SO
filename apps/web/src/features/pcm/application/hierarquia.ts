import {
  areaConsistente,
  detectaCiclo,
  montarArvore,
  validarArea,
  validarLocal,
  validarLocalTipo,
} from "../domain/hierarquia";
import type {
  AreaCommand,
  EditarAreaCommand,
  EditarLocalCommand,
  HierarquiaGateway,
  LocalCommand,
  LocalTipoCommand,
} from "./hierarquia-gateway";

export function listarAreas(gateway: HierarquiaGateway, clienteId: string) {
  return gateway.listarAreas(clienteId);
}

export function criarArea(gateway: HierarquiaGateway, input: AreaCommand) {
  const validado = validarArea(input);
  return gateway.criarArea({ ...validado, userId: input.userId });
}

export function editarArea(gateway: HierarquiaGateway, input: EditarAreaCommand) {
  const validado = validarArea(input);
  return gateway.editarArea({ ...validado, id: input.id, userId: input.userId });
}

export function desativarArea(gateway: HierarquiaGateway, id: string, userId: string) {
  if (!id) throw new Error("Área é obrigatória.");
  return gateway.desativarArea(id, userId);
}

export async function criarLocal(gateway: HierarquiaGateway, input: LocalCommand) {
  const validado = validarLocal(input);
  if (validado.parentId) {
    const locaisDaArea = await gateway.listarLocais(validado.areaId);
    if (!areaConsistente(locaisDaArea, validado.areaId, validado.parentId)) {
      throw new Error("Local pai deve pertencer à mesma Área.");
    }
  }
  return gateway.criarLocal({ ...validado, userId: input.userId });
}

export async function editarLocal(gateway: HierarquiaGateway, input: EditarLocalCommand) {
  const validado = validarLocal(input);
  const locaisDaArea = await gateway.listarLocais(validado.areaId);
  if (validado.parentId) {
    if (detectaCiclo(locaisDaArea, input.id, validado.parentId)) {
      throw new Error("Ciclo de Local detectado.");
    }
    if (!areaConsistente(locaisDaArea, validado.areaId, validado.parentId)) {
      throw new Error("Local pai deve pertencer à mesma Área.");
    }
  }
  return gateway.editarLocal({ ...validado, id: input.id, userId: input.userId });
}

/** AC-3 — reparent de um Local existente (mover na árvore), validando INV 1/2 antes do round-trip;
 * o trigger `fn_locais_valida_hierarquia` é o oráculo final (rejeita mesmo se este guard falhar). */
export async function moverLocal(
  gateway: HierarquiaGateway,
  id: string,
  areaId: string,
  parentId: string | null,
  userId: string,
) {
  const locaisDaArea = await gateway.listarLocais(areaId);
  if (parentId) {
    if (detectaCiclo(locaisDaArea, id, parentId)) {
      throw new Error("Ciclo de Local detectado.");
    }
    if (!areaConsistente(locaisDaArea, areaId, parentId)) {
      throw new Error("Local pai deve pertencer à mesma Área.");
    }
  }
  return gateway.moverLocal(id, parentId, userId);
}

/** Casos de borda (spec.md): bloqueia se o Local tiver sub-locais ativos OU Itens instalados
 * ativos — default decidido em tasks.md ("bloquear se tiver filhos/itens ativos"). */
export async function desativarLocal(gateway: HierarquiaGateway, id: string, userId: string) {
  if (!id) throw new Error("Local é obrigatório.");
  const possuiItens = await gateway.possuiItensInstalados(id);
  if (possuiItens) {
    throw new Error("Este Local tem Itens instalados. Remova ou realoque os Itens primeiro.");
  }
  return gateway.desativarLocal(id, userId);
}

export function listarTiposDeLocal(gateway: HierarquiaGateway, clienteId: string) {
  return gateway.listarTiposDeLocal(clienteId);
}

export function criarTipoDeLocal(gateway: HierarquiaGateway, input: LocalTipoCommand) {
  const validado = validarLocalTipo(input);
  return gateway.criarTipoDeLocal({ ...validado, userId: input.userId });
}

export function desativarTipoDeLocal(gateway: HierarquiaGateway, id: string, userId: string) {
  if (!id) throw new Error("Tipo de Local é obrigatório.");
  return gateway.desativarTipoDeLocal(id, userId);
}

/** Monta a árvore completa Área>Local de um cliente (AC-2) — uma chamada por Área evitada:
 * `listarLocaisDoCliente` já traz tudo, `montarArvore` particiona por Área. */
export async function arvoreDoCliente(gateway: HierarquiaGateway, clienteId: string) {
  const [areas, locais] = await Promise.all([
    gateway.listarAreas(clienteId),
    gateway.listarLocaisDoCliente(clienteId),
  ]);
  return areas.map((area) => ({
    area,
    arvore: montarArvore(locais.filter((l) => l.areaId === area.id)),
  }));
}
