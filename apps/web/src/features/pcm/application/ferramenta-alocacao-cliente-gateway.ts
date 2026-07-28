import type { AlocacaoFerramentaCliente } from "../domain/ferramenta-alocacao-cliente";

export interface FerramentaOpcao {
  id: string;
  nome: string;
}

export interface FerramentaAlocacaoClienteGateway {
  listarPorCliente(clienteId: string): Promise<AlocacaoFerramentaCliente[]>;
  /** Ferramentas sem alocação ativa em nenhum cliente no momento (podem ser alocadas). */
  listarDisponiveis(): Promise<FerramentaOpcao[]>;
  alocar(
    ferramentaId: string,
    clienteId: string,
    userId: string,
  ): Promise<AlocacaoFerramentaCliente>;
  devolver(alocacaoId: string, userId: string): Promise<void>;
}
