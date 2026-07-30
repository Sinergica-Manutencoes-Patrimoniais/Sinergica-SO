export interface ClienteAlmaGateway {
  obter(clienteId: string): Promise<string>;
  salvar(clienteId: string, conteudo: string, userId: string): Promise<void>;
}
