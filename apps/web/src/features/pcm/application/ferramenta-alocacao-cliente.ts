import type { FerramentaAlocacaoClienteGateway } from "./ferramenta-alocacao-cliente-gateway";

export function listarAlocacoesCliente(
  gateway: FerramentaAlocacaoClienteGateway,
  clienteId: string,
) {
  return gateway.listarPorCliente(clienteId);
}

export function listarAlocacoesAtivas(gateway: FerramentaAlocacaoClienteGateway) {
  return gateway.listarAtivas();
}

export function listarFerramentasDisponiveis(gateway: FerramentaAlocacaoClienteGateway) {
  return gateway.listarDisponiveis();
}

export function listarClientesParaAlocacao(gateway: FerramentaAlocacaoClienteGateway) {
  return gateway.listarClientesAtivos();
}

export function alocarFerramenta(
  gateway: FerramentaAlocacaoClienteGateway,
  ferramentaId: string,
  clienteId: string,
  userId: string,
) {
  if (!ferramentaId) throw new Error("Ferramenta é obrigatória.");
  if (!clienteId) throw new Error("Cliente é obrigatório.");
  return gateway.alocar(ferramentaId, clienteId, userId);
}

export function devolverFerramenta(
  gateway: FerramentaAlocacaoClienteGateway,
  alocacaoId: string,
  userId: string,
) {
  return gateway.devolver(alocacaoId, userId);
}
