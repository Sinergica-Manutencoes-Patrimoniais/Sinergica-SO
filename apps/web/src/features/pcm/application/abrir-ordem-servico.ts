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
  return gateway.criarOrdemServico({ ...input, titulo });
}
