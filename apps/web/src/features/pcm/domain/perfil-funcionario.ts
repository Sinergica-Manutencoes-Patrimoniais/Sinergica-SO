import type { AlocacaoTecnico } from "./agenda-tecnico";

export function alocacoesDaSemanaFuncionario(
  alocacoes: readonly AlocacaoTecnico[],
  funcionarioId: string,
): AlocacaoTecnico[] {
  return alocacoes.filter((alocacao) => alocacao.funcionarioId === funcionarioId);
}

export function rotuloQuantidadeOsFuncionario(quantidade: number): string {
  return quantidade === 0 ? "Nenhuma OS no período" : `${quantidade} OS no PCM`;
}
