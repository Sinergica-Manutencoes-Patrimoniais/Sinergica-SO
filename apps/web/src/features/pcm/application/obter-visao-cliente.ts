// Caso de uso principal da Visão 360 (E01-S12) — orquestra o gateway, sem I/O direto.
import type {
  Cliente360Gateway,
  ClienteHeader,
  OrdemServicoResumo,
  ResultadoEquipamentos,
} from "./cliente-360-gateway";

/**
 * Resultado da Visão 360. `nao_encontrado` (AC-8) é um estado de primeira classe — nunca um erro —
 * para a página renderizar um "cliente não encontrado" limpo em vez de crashar.
 */
export type VisaoCliente =
  | { tipo: "nao_encontrado" }
  | {
      tipo: "ok";
      cliente: ClienteHeader;
      backlog: OrdemServicoResumo[];
      historico: OrdemServicoResumo[];
      equipamentos: ResultadoEquipamentos;
    };

/**
 * Busca o cliente; se não existe (`null`) retorna `nao_encontrado` SEM disparar as demais queries
 * (AC-8). Caso exista, carrega backlog, histórico e equipamentos em paralelo (`Promise.all`). O
 * estado `"indisponivel"` de equipamentos (AC-6) não derruba nada — ele viaja intacto até a UI.
 * Cliente sem nenhuma OS retorna backlog/histórico vazios (`[]`), nunca erro (AC-5).
 */
export async function obterVisaoCliente(
  gateway: Cliente360Gateway,
  clienteId: string,
): Promise<VisaoCliente> {
  const cliente = await gateway.buscarCliente(clienteId);
  if (cliente === null) return { tipo: "nao_encontrado" };

  const [backlog, historico, equipamentos] = await Promise.all([
    gateway.listarBacklogCliente(clienteId),
    gateway.listarHistoricoCliente(clienteId),
    gateway.listarEquipamentosCliente(clienteId, cliente.auvoId),
  ]);

  return { tipo: "ok", cliente, backlog, historico, equipamentos };
}
