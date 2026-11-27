import { useQuery } from "@tanstack/react-query";
import type { FinanceiroGateway } from "./financeiro-gateway";
import { listarCustosFuncionario, listarFuncionariosOpcoes } from "./rentabilidade";

export const rentabilidadeQueryKeys = {
  custosPessoal: (usuarioId: string | undefined) =>
    ["financeiro", "custos-pessoal", usuarioId] as const,
};

export function useCustosPessoal(
  gateway: FinanceiroGateway,
  usuarioId: string | undefined,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: rentabilidadeQueryKeys.custosPessoal(usuarioId),
    enabled: habilitado,
    queryFn: async () => {
      const [custos, funcionarios] = await Promise.all([
        listarCustosFuncionario(gateway),
        listarFuncionariosOpcoes(gateway),
      ]);
      return { custos, funcionarios };
    },
  });
}
