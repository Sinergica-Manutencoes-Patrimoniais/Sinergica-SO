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

export function baixarComprovante(gateway: FinanceiroGateway, lancamentoId: string) {
  return gateway.baixarComprovante(lancamentoId);
}

/** A assinatura determina apenas a extensão do download, não autentica o conteúdo. */
export function nomeSeguroComprovante(arquivo: Blob): Promise<string> {
  return new Promise((resolve) => {
    const leitor = new FileReader();
    leitor.onerror = () => resolve("comprovante.bin");
    leitor.onload = () => {
      if (!(leitor.result instanceof ArrayBuffer)) return resolve("comprovante.bin");
      const b = new Uint8Array(leitor.result);
      const inicia = (assinatura: number[]) => assinatura.every((valor, i) => b[i] === valor);
      const extensao = inicia([0x25, 0x50, 0x44, 0x46, 0x2d])
        ? "pdf"
        : inicia([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          ? "png"
          : inicia([0xff, 0xd8, 0xff])
            ? "jpg"
            : inicia([0x52, 0x49, 0x46, 0x46]) &&
                b[8] === 0x57 &&
                b[9] === 0x45 &&
                b[10] === 0x42 &&
                b[11] === 0x50
              ? "webp"
              : "bin";
      resolve(`comprovante.${extensao}`);
    };
    leitor.readAsArrayBuffer(arquivo.slice(0, 12));
  });
}

/** O serviço entrega bytes genéricos: nunca executar conteúdo recebido no navegador. */
export function salvarComprovante(arquivo: Blob, nome = "comprovante.bin") {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
