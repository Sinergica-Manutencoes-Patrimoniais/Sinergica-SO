import { montarRelatorioCliente } from "../domain/relatorio-cliente";
import type { HubOsGateway } from "./hub-os-gateway";

/** E01-S135 T2: a leitura do relatório já restringe as OS ao cliente no servidor. O domínio só
 * transforma o conjunto permitido em passado e cronograma, sem acesso ao Supabase. */
export async function obterRelatorioCliente(
  gateway: HubOsGateway,
  cliente: { id: string; nome: string },
  periodo: { inicio: string; fim: string },
) {
  const ordens = await gateway.listarOrdensServico({ clienteId: cliente.id });
  return montarRelatorioCliente(cliente, periodo.inicio, periodo.fim, ordens);
}
