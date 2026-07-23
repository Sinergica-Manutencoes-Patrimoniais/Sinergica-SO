import { calcularJanela, validarMensagensParaSnapshot } from "../domain/historico-chamado";
import type { HistoricoChamadoSnapshot } from "../domain/historico-chamado";
import type { ChamadoOpcao, HistoricoChamadoGateway } from "./historico-chamado-gateway";

export function listarChamadosDoCliente(gateway: HistoricoChamadoGateway, clienteId: string) {
  return gateway.listarChamadosDoCliente(clienteId);
}

export async function criarChamadoRapido(
  gateway: HistoricoChamadoGateway,
  clienteId: string,
  titulo: string,
  userId: string,
): Promise<ChamadoOpcao> {
  const tituloLimpo = titulo.trim();
  if (!tituloLimpo) throw new Error("Título é obrigatório.");
  if (!clienteId) throw new Error("Cliente é obrigatório.");
  return gateway.criarChamadoRapido(clienteId, tituloLimpo, userId);
}

/** AC-1/AC-3: recorta a janela, valida que há mensagens (caso de borda) e grava o snapshot
 * imutável — anexar de novo (mesmo Chamado, mesma conversa) sempre cria um registro novo. */
export async function enviarHistoricoParaChamado(
  gateway: HistoricoChamadoGateway,
  input: { conversaId: string; chamadoId: string; janelaDias: number; userId: string },
): Promise<HistoricoChamadoSnapshot> {
  const { dataInicio, dataFim } = calcularJanela(input.janelaDias);
  const mensagens = await gateway.listarMensagensDaJanela(input.conversaId, dataInicio, dataFim);
  validarMensagensParaSnapshot(mensagens);
  return gateway.salvarSnapshot({
    conversaId: input.conversaId,
    chamadoId: input.chamadoId,
    janelaDias: input.janelaDias,
    dataInicio,
    dataFim,
    mensagens,
    userId: input.userId,
  });
}

export function listarSnapshotsDoChamado(gateway: HistoricoChamadoGateway, chamadoId: string) {
  return gateway.listarSnapshotsDoChamado(chamadoId);
}
