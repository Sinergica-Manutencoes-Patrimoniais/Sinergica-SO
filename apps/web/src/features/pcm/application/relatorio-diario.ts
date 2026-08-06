import {
  type SaudeSyncRelatorioDiario,
  montarResumoRelatorioDiario,
} from "../domain/relatorio-diario";
import type { ApontamentoHorasGateway } from "./apontamento-horas-gateway";
import type { ChamadosGateway } from "./chamados-gateway";
import type { HubOsGateway } from "./hub-os-gateway";

export interface SaudeSyncGatewayRelatorioDiario {
  obterSaudeSync(): Promise<SaudeSyncRelatorioDiario[]>;
}

/** E01-S134 T2: leitura sob demanda. A saúde do Auvo é complementar: se estiver indisponível, o
 * resumo operacional continua e sinaliza essa ausência na seção Atenção. */
export async function obterResumoRelatorioDiario(
  dia: string,
  gateways: {
    ordens: HubOsGateway;
    chamados: ChamadosGateway;
    apontamentos: ApontamentoHorasGateway;
    saude: SaudeSyncGatewayRelatorioDiario;
  },
) {
  const [ordens, chamados, apontamentos, resultadoSaude] = await Promise.all([
    gateways.ordens.listarOrdensServico(),
    gateways.chamados.listar(),
    gateways.apontamentos.listarApontamentos(dia, dia),
    gateways.saude.obterSaudeSync().then(
      (saude) => ({ saude, indisponivel: false as const }),
      () => ({ saude: null, indisponivel: true as const }),
    ),
  ]);
  return montarResumoRelatorioDiario(dia, {
    ordens,
    chamados,
    apontamentos,
    saudeSync: resultadoSaude.saude,
  });
}
