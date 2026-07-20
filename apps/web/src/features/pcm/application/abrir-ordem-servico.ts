import { inferirTipoOsHub } from "../domain/hub-os";
import type {
  CriarOrdemServicoInput,
  DadosAberturaOs,
  OrdemServicoCriada,
  OrdemServicoGateway,
} from "./ordem-servico-gateway";

export function carregarDadosAberturaOs(gateway: OrdemServicoGateway): Promise<DadosAberturaOs> {
  return gateway.carregarDadosAbertura();
}

export async function abrirOrdemServico(
  gateway: OrdemServicoGateway,
  input: CriarOrdemServicoInput,
): Promise<OrdemServicoCriada> {
  const titulo = input.titulo.trim();
  if (!input.clientId) throw new Error("Cliente é obrigatório.");
  if (!titulo) throw new Error("Título é obrigatório.");
  if (!input.tipoTarefaId) throw new Error("Tipo de tarefa é obrigatório.");
  // E01-S07 AC-1: tipo do Hub inferido na criação; nenhum produtor de pmocScheduleId ainda
  // (Edge Function pmoc-auvo-create-os é deferida — ver design.md/ADR-0010), sempre null aqui.
  const pmocScheduleId = null;
  return gateway.criarOrdemServico({
    ...input,
    titulo,
    tipoOs: inferirTipoOsHub(input.categoria, pmocScheduleId),
    pmocScheduleId,
  });
}
