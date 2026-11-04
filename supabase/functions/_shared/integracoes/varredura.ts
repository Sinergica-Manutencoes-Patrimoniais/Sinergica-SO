import { projetarReconciliacao, type FatosReconciliacao, type ProjecaoReconciliacao } from "./projecao.ts";

/** Identidade e fatos mínimos fornecidos pelo fluxo proprietário, sem payload ou custos. */
export interface OrigemVarredura {
  chave: string;
  clienteId: string;
  integracao: string;
  tipoObjeto: string;
  objetoId: string;
  versaoFonte: number;
  correlacaoId: string;
  fatos: FatosReconciliacao;
}

export interface PaginaVarredura {
  origens: readonly OrigemVarredura[];
  proximoCursor: string | null;
}

/**
 * O adaptador pertence ao proprietário da fonte. A gravação precisa comparar a
 * versão e os fatos dentro da transação, usar (execucaoId, chave) como identidade
 * idempotente e manter ocorrência e histórico juntos. Uma fonte alterada não
 * pode ser gravada com a projeção anterior.
 */
export interface PortaVarredura {
  consultar(cursor: string | null, limite: number): Promise<PaginaVarredura>;
  registrar(entrada: {
    execucaoId: string;
    origem: OrigemVarredura;
    projecao: ProjecaoReconciliacao;
  }): Promise<"registrado" | "inalterado" | "fonte_alterada">;
}

export interface ResultadoVarredura {
  processados: number;
  registrados: number;
  inalterados: number;
  proximoCursor: string | null;
}

function textoValido(valor: unknown, limite: number): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor.length <= limite && valor.trim() === valor;
}

function validarOrigem(origem: OrigemVarredura): void {
  if (!origem || !textoValido(origem.chave, 500) || !textoValido(origem.clienteId, 128) ||
    !textoValido(origem.integracao, 100) || !textoValido(origem.tipoObjeto, 100) ||
    !textoValido(origem.objetoId, 128) || !textoValido(origem.correlacaoId, 200) ||
    !Number.isSafeInteger(origem.versaoFonte) || origem.versaoFonte < 1 || !origem.fatos ||
    !["pendente", "processando", "falha", "concluido"].includes(origem.fatos.estadoLocal) ||
    !["nao_iniciado_comprovado", "desconhecido", "confirmado", "divergente"].includes(origem.fatos.efeitoRemoto) ||
    !["transitoria", "permanente", "desconhecida", null].includes(origem.fatos.classificacaoFalha) ||
    !["vigente", "expirado", "nao_aplicavel"].includes(origem.fatos.lease)) {
    throw new Error("Origem de reconciliação inválida.");
  }
}

/**
 * Processa uma página. Não consulta o destino, não dispara retry e não fecha
 * alerta baseado em estado local. O cursor só é devolvido após todos os
 * registros; em falha o chamador repete a mesma execução e página.
 */
export async function verificarPendencias(
  porta: PortaVarredura,
  entrada: { execucaoId: string; cursor: string | null; limite: number },
): Promise<ResultadoVarredura> {
  if (!textoValido(entrada.execucaoId, 128) ||
    (entrada.cursor !== null && !textoValido(entrada.cursor, 1000)) ||
    !Number.isSafeInteger(entrada.limite) || entrada.limite < 1 || entrada.limite > 100) {
    throw new Error("Parâmetros de varredura inválidos.");
  }
  const pagina = await porta.consultar(entrada.cursor, entrada.limite);
  if (!pagina || !Array.isArray(pagina.origens) || pagina.origens.length > entrada.limite ||
    (pagina.proximoCursor !== null && !textoValido(pagina.proximoCursor, 1000)) ||
    (pagina.proximoCursor !== null && (pagina.proximoCursor === entrada.cursor || pagina.origens.length === 0))) {
    throw new Error("Página de varredura inválida.");
  }
  const chaves = new Set<string>();
  for (const origem of pagina.origens) {
    validarOrigem(origem);
    if (chaves.has(origem.chave)) throw new Error("Origem duplicada na página.");
    chaves.add(origem.chave);
  }
  const resultado: ResultadoVarredura = {
    processados: 0, registrados: 0, inalterados: 0,
    proximoCursor: pagina.proximoCursor,
  };
  for (const origem of pagina.origens) {
    const situacao = await porta.registrar({ execucaoId: entrada.execucaoId, origem, projecao: projetarReconciliacao(origem.fatos) });
    if (situacao === "registrado") resultado.registrados++;
    else if (situacao === "inalterado") resultado.inalterados++;
    else if (situacao === "fonte_alterada") throw new Error("Fonte alterada durante a varredura; consulte novamente.");
    else throw new Error("Resultado de registro inválido.");
    resultado.processados++;
  }
  return resultado;
}
