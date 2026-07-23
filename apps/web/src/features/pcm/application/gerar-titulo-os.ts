import { podeGerarTitulo, sanearTituloGerado } from "../domain/titulo-os";
import type { OrdemServicoGateway } from "./ordem-servico-gateway";

export function iaTituloAtiva(gateway: OrdemServicoGateway): Promise<boolean> {
  return gateway.iaTituloAtiva();
}

export async function gerarTituloOs(
  gateway: OrdemServicoGateway,
  descricao: string,
): Promise<string> {
  if (!podeGerarTitulo(descricao)) throw new Error("Descrição é obrigatória para gerar o título.");
  const bruto = await gateway.gerarTituloOs(descricao.trim());
  return sanearTituloGerado(bruto);
}
