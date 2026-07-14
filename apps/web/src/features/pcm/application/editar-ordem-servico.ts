import type { EditarOrdemServicoInput, OrdemServicoGateway } from "./ordem-servico-gateway";

export async function editarOrdemServico(
  gateway: OrdemServicoGateway,
  input: EditarOrdemServicoInput,
): Promise<void> {
  const titulo = input.titulo.trim();
  if (!input.id) throw new Error("OS é obrigatória.");
  if (!titulo) throw new Error("Título é obrigatório.");
  return gateway.editarOrdemServico({ ...input, titulo });
}
