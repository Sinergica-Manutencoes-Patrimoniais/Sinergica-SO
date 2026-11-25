/** E02-S24 AC-3: o resumo rolante é GERADO pelo job `atendimento-memoria-resumo` (service_role)
 * e só lido aqui — a UI nunca escreve nele, para não divergir do que a IA de fato resumiu
 * (é também o que a RLS da migration 0159 permite: select para `authenticated`, escrita só
 * `service_role`). */
export interface MemoriaResumoCliente {
  resumo: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  atualizadoEm: string;
}

export interface ClienteAlmaGateway {
  obter(clienteId: string): Promise<string>;
  salvar(clienteId: string, conteudo: string, userId: string): Promise<void>;
  obterResumo(clienteId: string): Promise<MemoriaResumoCliente | null>;
}
