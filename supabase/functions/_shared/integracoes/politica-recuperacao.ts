/** Política de recuperação: não envia pedidos nem altera estado do proprietário. */
export type ResultadoTentativa = {
  efeito: "nenhum_comprovado" | "incerto";
  statusHttp: number | null;
  retryAfter: string | null;
  tentativas: number;
  limiteTentativas: number;
  agoraMs: number;
  atrasoBaseMs: number;
  atrasoMaximoMs: number;
};

export type OrientacaoRecuperacao =
  | { acao: "conciliar" }
  | { acao: "revisao_manual" }
  | { acao: "delegar_retry"; naoAntesDeMs: number };

/**
 * Retry-After limita o instante mais cedo, nunca autoriza por si só uma repetição.
 * Ausência de efeito deve ser provada pelo fluxo proprietário; erro de rede ou
 * resposta HTTP não constituem essa prova. O chamador deve revalidar estado,
 * autorização, revisão e idempotência antes de efetivar qualquer comando.
 */
export function orientarRecuperacao(t: ResultadoTentativa): OrientacaoRecuperacao {
  if (!t || !["nenhum_comprovado", "incerto"].includes(t.efeito) ||
    (t.statusHttp !== null && (!Number.isInteger(t.statusHttp) || t.statusHttp < 100 || t.statusHttp > 599)) ||
    (t.retryAfter !== null && typeof t.retryAfter !== "string") ||
    !Number.isSafeInteger(t.tentativas) || t.tentativas < 0 ||
    !Number.isSafeInteger(t.limiteTentativas) || t.limiteTentativas < 1 ||
    !Number.isSafeInteger(t.agoraMs) || t.agoraMs < 0 ||
    !Number.isSafeInteger(t.atrasoBaseMs) || t.atrasoBaseMs < 1 ||
    !Number.isSafeInteger(t.atrasoMaximoMs) || t.atrasoMaximoMs < t.atrasoBaseMs) {
    throw new Error("Dados de recuperação inválidos.");
  }
  if (t.efeito === "incerto") return { acao: "conciliar" };
  if (t.tentativas >= t.limiteTentativas) return { acao: "revisao_manual" };
  if (t.statusHttp !== null && t.statusHttp !== 408 && t.statusHttp !== 429 &&
    (t.statusHttp < 500 || t.statusHttp > 599)) return { acao: "revisao_manual" };

  const exponencial = Math.min(t.atrasoMaximoMs, t.atrasoBaseMs * 2 ** Math.min(t.tentativas, 53));
  let minimoFornecedor = t.agoraMs;
  if (t.retryAfter !== null) {
    const valor = t.retryAfter.trim();
    if (/^\d+$/.test(valor)) {
      const segundos = Number(valor);
      if (!Number.isSafeInteger(segundos) || segundos > Math.floor((Number.MAX_SAFE_INTEGER - t.agoraMs) / 1000)) {
        return { acao: "revisao_manual" };
      }
      minimoFornecedor += segundos * 1000;
    } else {
      const data = Date.parse(valor);
      if (!Number.isSafeInteger(data)) return { acao: "revisao_manual" };
      minimoFornecedor = Math.max(t.agoraMs, data);
    }
  }
  if (exponencial > Number.MAX_SAFE_INTEGER - t.agoraMs) return { acao: "revisao_manual" };
  return { acao: "delegar_retry", naoAntesDeMs: Math.max(t.agoraMs + exponencial, minimoFornecedor) };
}
