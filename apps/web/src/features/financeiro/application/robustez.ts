import { validarTransferencia } from "../domain/transferencia";
import type {
  EditarLancamentoCommand,
  FinanceiroGateway,
  TransferenciaCommand,
} from "./financeiro-gateway";

export function anexarComprovante(gateway: FinanceiroGateway, lancamentoId: string, arquivo: File) {
  const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new Error("Tipo de arquivo inválido — envie PDF, PNG, JPEG ou WEBP.");
  }
  if (arquivo.size > TAMANHO_MAX_BYTES) {
    throw new Error("Arquivo maior que 10MB.");
  }
  return gateway.anexarComprovante(lancamentoId, arquivo);
}

export function urlAssinadaComprovante(gateway: FinanceiroGateway, path: string) {
  return gateway.urlAssinadaComprovante(path);
}

export function corrigirLancamento(gateway: FinanceiroGateway, input: EditarLancamentoCommand) {
  return gateway.corrigirLancamento(input);
}

export function estornarLancamentoRealizado(
  gateway: FinanceiroGateway,
  lancamentoId: string,
  userId: string,
) {
  return gateway.estornarLancamentoRealizado(lancamentoId, userId);
}

export function criarTransferencia(gateway: FinanceiroGateway, input: TransferenciaCommand) {
  const validado = validarTransferencia(input);
  return gateway.criarTransferencia({ ...validado, userId: input.userId });
}
