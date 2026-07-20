import type { IntegracoesGateway, SalvarIntegracaoInput } from "./integracoes-gateway";

export function listarIntegracoes(gateway: IntegracoesGateway) {
  return gateway.listar();
}

export function salvarMetadadoIntegracao(
  gateway: IntegracoesGateway,
  input: SalvarIntegracaoInput,
) {
  const chave = input.chave.trim();
  if (!chave) throw new Error("Chave da integração é obrigatória.");
  return gateway.salvarMetadado({ ...input, chave });
}

export function definirSegredoIntegracao(
  gateway: IntegracoesGateway,
  chave: string,
  valor: string,
) {
  const chaveNormalizada = chave.trim();
  const valorNormalizado = valor.trim();
  if (!chaveNormalizada) throw new Error("Chave da integração é obrigatória.");
  if (!valorNormalizado) throw new Error("Valor do segredo é obrigatório.");
  return gateway.definirSegredo(chaveNormalizada, valorNormalizado);
}
