import type { ResponsavelCliente, ResponsavelFormData } from "../domain/cliente-responsaveis";

export interface ClienteResponsaveisGateway {
  listarPorCliente(clienteId: string): Promise<ResponsavelCliente[]>;
  criar(input: ResponsavelFormData): Promise<ResponsavelCliente>;
  editar(id: string, input: ResponsavelFormData): Promise<ResponsavelCliente>;
  remover(id: string): Promise<void>;
}
