// Caso de uso: lista mínima de clientes do PCM (Task 18/E01-S12) — ponto de entrada de navegação
// até a Visão 360. Passthrough fino sobre o gateway (mesmo estilo de listarGrupos): a ordenação
// (nome asc) roda no servidor; a application só repassa o read-model, sem I/O direto nem reordenar.
import type { Cliente360Gateway, ClienteResumo } from "./cliente-360-gateway";

export async function listarClientes(gateway: Cliente360Gateway): Promise<ClienteResumo[]> {
  return gateway.listarClientes();
}
