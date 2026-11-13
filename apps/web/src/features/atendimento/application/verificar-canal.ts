// E02-S35 (ADR-1686, plan.md "Application") — verificação sob demanda: aplica o resultado real de
// uma chamada à Evolution sobre o estado/saúde do canal (AC-7). Falha de autenticação desconecta
// na hora (não espera alguém investigar); outra falha só degrada a saúde.

import type { CanalEvolution } from "../domain/canal-evolution";
import { marcarSessaoCaida, registrarErro, registrarSucesso } from "../domain/canal-evolution";

export interface ResultadoDaVerificacao {
  sucesso: boolean;
  falhaDeAutenticacao?: boolean;
  mensagem: string;
}

export interface VerificadorDeCanal {
  verificar(canal: CanalEvolution): Promise<ResultadoDaVerificacao>;
}

export interface CanalVerificado {
  canal: CanalEvolution;
  resultado: ResultadoDaVerificacao;
}

export async function verificarCanal(
  verificador: VerificadorDeCanal,
  canal: CanalEvolution,
  agora: string = new Date().toISOString(),
): Promise<CanalVerificado> {
  const resultado = await verificador.verificar(canal);

  if (resultado.sucesso) {
    return { canal: registrarSucesso(canal, agora), resultado };
  }
  if (resultado.falhaDeAutenticacao) {
    return { canal: marcarSessaoCaida(canal, agora), resultado };
  }
  return { canal: registrarErro(canal, agora), resultado };
}
