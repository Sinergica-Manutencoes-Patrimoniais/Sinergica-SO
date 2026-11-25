import {
  validarCanalExterno,
  validarConexaoMeta,
  validarWaTemplate,
} from "../domain/canais-externos";
import type {
  CanalExternoFormData,
  ConexaoMetaFormData,
  TipoCanalExterno,
  WaTemplateFormData,
} from "../domain/canais-externos";
import type { CanaisExternosGateway } from "./canais-externos-gateway";

export async function listarCanaisExternos(gateway: CanaisExternosGateway, tipo: TipoCanalExterno) {
  return gateway.listarCanais(tipo);
}

export async function criarCanalExterno(
  gateway: CanaisExternosGateway,
  input: CanalExternoFormData & { userId: string },
) {
  const validado = validarCanalExterno(input);
  return gateway.criarCanal({ ...validado, userId: input.userId });
}

export async function editarCanalExterno(
  gateway: CanaisExternosGateway,
  input: CanalExternoFormData & { id: string; userId: string },
) {
  const validado = validarCanalExterno(input);
  return gateway.editarCanal({ ...validado, id: input.id, userId: input.userId });
}

export async function desativarCanalExterno(gateway: CanaisExternosGateway, id: string) {
  return gateway.desativarCanal(id);
}

export async function conectarCanalMeta(
  gateway: CanaisExternosGateway,
  input: ConexaoMetaFormData,
) {
  return gateway.conectarCanalMeta(validarConexaoMeta(input));
}

export async function obterEstadoCanalMeta(gateway: CanaisExternosGateway, canalId: string) {
  if (!canalId) throw new Error("Selecione a conexão.");
  return gateway.obterEstadoMeta(canalId);
}

export async function verificarCanalMeta(gateway: CanaisExternosGateway, canalId: string) {
  if (!canalId) throw new Error("Selecione a conexão.");
  return gateway.verificarCanalMeta(canalId);
}

export async function listarWaTemplates(gateway: CanaisExternosGateway) {
  return gateway.listarTemplates();
}

export async function criarWaTemplate(
  gateway: CanaisExternosGateway,
  input: WaTemplateFormData & { userId: string },
) {
  const validado = validarWaTemplate(input);
  return gateway.criarTemplate({ ...validado, userId: input.userId });
}

export async function editarWaTemplate(
  gateway: CanaisExternosGateway,
  input: WaTemplateFormData & { id: string; userId: string },
) {
  if (!input.id) throw new Error("Template é obrigatório.");
  return gateway.editarTemplate({
    ...validarWaTemplate(input),
    id: input.id,
    userId: input.userId,
  });
}
