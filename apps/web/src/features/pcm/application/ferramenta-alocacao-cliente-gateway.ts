import type { AlocacaoFerramentaCliente } from "../domain/ferramenta-alocacao-cliente";

export interface FerramentaOpcao {
  id: string;
  nome: string;
}

export interface ClienteOpcaoFerramenta {
  id: string;
  nome: string;
}

export interface FerramentaAlocacaoClienteGateway {
  listarPorCliente(clienteId: string): Promise<AlocacaoFerramentaCliente[]>;
  /** E01-S113: todas as alocações ativas (qualquer cliente) — hub "Ferramentas" > aba "Por
   * Cliente", visão operacional centralizada (sem escopo de um único cliente). */
  listarAtivas(): Promise<AlocacaoFerramentaCliente[]>;
  /** Ferramentas sem alocação ativa em nenhum cliente no momento (podem ser alocadas). */
  listarDisponiveis(): Promise<FerramentaOpcao[]>;
  /** E01-S113: clientes ativos, pra popular o seletor de cliente do formulário de alocação. */
  listarClientesAtivos(): Promise<ClienteOpcaoFerramenta[]>;
  alocar(
    ferramentaId: string,
    clienteId: string,
    userId: string,
  ): Promise<AlocacaoFerramentaCliente>;
  devolver(alocacaoId: string, userId: string): Promise<void>;
}
