import { useQuery } from "@tanstack/react-query";
import type { Cliente360Gateway } from "./cliente-360-gateway";

export const relatorioClienteQueryKeys = {
  clientes: (userId: string | undefined) =>
    ["pcm", "relatorio-cliente", userId, "clientes"] as const,
  periodo: (userId: string, clienteId: string, inicio: string, fim: string) =>
    ["pcm", "relatorio-cliente", userId, clienteId, inicio, fim] as const,
};

export function useClientesRelatorioQuery(
  gateway: Pick<Cliente360Gateway, "listarClientes">,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: relatorioClienteQueryKeys.clientes(userId),
    enabled: Boolean(userId),
    queryFn: async () => (await gateway.listarClientes()).filter((cliente) => cliente.ativo),
  });
}
