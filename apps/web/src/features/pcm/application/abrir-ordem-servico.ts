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
  // E01-S07 AC-1 / E01-S05: tipo do Hub inferido na criação. `pmocScheduleId` só chega aqui quando
  // o caller sabe que a OS nasce de uma visita PMOC (E01-S05 "Criar OS" síncrono) — omitido em
  // toda criação manual normal. `chamadoId` (E01-S88 AC-3) segue o mesmo padrão pro Chamado.
  const pmocScheduleId = input.pmocScheduleId ?? null;
  return gateway.criarOrdemServico({
    ...input,
    titulo,
    tipoOs: inferirTipoOsHub(input.categoria, pmocScheduleId),
    pmocScheduleId,
    chamadoId: input.chamadoId ?? null,
    origemInspecaoItemId: input.origemInspecaoItemId ?? null,
  });
}
