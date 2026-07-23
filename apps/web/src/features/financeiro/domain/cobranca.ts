export type CobrancaTipo = "boleto" | "pix";
export type CobrancaStatus = "pendente" | "pago" | "cancelado" | "estornado" | "expirado";

export interface CobrancaItem {
  id: string;
  lancamentoId: string;
  tipo: CobrancaTipo;
  status: CobrancaStatus;
  externalId: string;
  linhaDigitavel: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  linkPagamento: string | null;
  valorCentavos: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** AC-2/caso de borda: só emite cobrança de um recebível ainda previsto — nunca de um já pago
 * (edge case "emitir cobrança de recebível já pago → bloqueia") nem de saída (só entrada). */
export function podeEmitirCobranca(lancamento: { tipo: string; status: string }): boolean {
  return lancamento.tipo === "entrada" && lancamento.status === "previsto";
}

/** AC-3: mapeia o status bruto do Mercado Pago (`payment.status`) pro nosso vocabulário —
 * https://www.mercadopago.com.br/developers/en/docs/checkout-api/response-handling/collection-status.
 * `in_process`/`authorized` contam como pendente (ainda não é dinheiro na conta); `charged_back` é
 * estorno bancário, tratado igual a `refunded`. */
export function mapStatusMercadoPago(status: string): CobrancaStatus {
  switch (status) {
    case "approved":
      return "pago";
    case "refunded":
    case "charged_back":
      return "estornado";
    case "cancelled":
    case "rejected":
      return "cancelado";
    case "expired":
      return "expirado";
    default:
      return "pendente";
  }
}
