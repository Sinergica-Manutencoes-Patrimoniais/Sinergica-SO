import { useQuery } from "@tanstack/react-query";

export interface PropostaSemCustos {
  id: string;
  tipo: string;
  status: string;
  escopo: string | null;
  precoCentavos: number;
  versao: number;
}

export interface PropostasSemCustosGateway {
  listar(oportunidadeId: string): Promise<PropostaSemCustos[]>;
}

export function usePropostasSemCustos(
  gateway: PropostasSemCustosGateway,
  userId: string,
  clienteId: string,
  oportunidadeId: string,
) {
  return useQuery({
    queryKey: ["comercial", "propostas-sem-custos", userId, clienteId, oportunidadeId],
    queryFn: () => gateway.listar(oportunidadeId),
    enabled: Boolean(userId && clienteId && oportunidadeId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
}
