import type {
  KpisOrdensServico,
  OrdemServicoOperacional,
  StatusOrdemServico,
} from "../domain/ordens-servico";
import type { PesosGutd } from "../domain/priorizacao-backlog";

export interface AlterarStatusOsInput {
  id: string;
  status: StatusOrdemServico;
  updatedBy: string;
}

/** E01-S44: filtros empurrados pro `WHERE` do servidor — `busca` (nome de cliente) fica de fora,
 * exige o JOIN em memória e continua sendo refinada no client (`filtrarOrdens`, E01-S42). */
export interface FiltrosServidorOrdens {
  status?: string;
  tecnicoFuncionarioId?: string;
  categoria?: string;
  dataInicio?: string | null;
  dataFim?: string | null;
}

export interface HubOsGateway {
  listarOrdensServico(filtros?: FiltrosServidorOrdens): Promise<OrdemServicoOperacional[]>;
  /** E01-S44: agregação server-side (RPC) — não baixa nenhuma OS pra calcular os 6 números. */
  contarKpis(filtros?: FiltrosServidorOrdens): Promise<KpisOrdensServico>;
  alterarStatus(input: AlterarStatusOsInput): Promise<OrdemServicoOperacional>;
  /** E01-S82 AC-2: pesos GUTD atuais — lidos por qualquer usuário do PCM pra ordenar em runtime. */
  obterPesosGutd(): Promise<PesosGutd>;
}
