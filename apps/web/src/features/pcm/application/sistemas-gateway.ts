import type { Sistema, SistemaFormData, SistemaItemMembro } from "../domain/sistemas";

export interface SistemaCommand extends SistemaFormData {
  userId: string;
}

export interface EditarSistemaCommand extends SistemaCommand {
  id: string;
}

export interface SistemaItemOpcao {
  id: string;
  nome: string;
  clientId: string | null;
}

export interface SistemasGateway {
  listar(clienteId?: string): Promise<Sistema[]>;
  obter(id: string): Promise<Sistema | null>;
  criar(input: SistemaCommand): Promise<Sistema>;
  editar(input: EditarSistemaCommand): Promise<Sistema>;
  desativar(id: string, userId: string): Promise<void>;

  listarItensDisponiveis(clienteId: string): Promise<SistemaItemOpcao[]>;
  listarItensDoSistema(sistemaId: string): Promise<SistemaItemMembro[]>;
  adicionarItem(sistemaId: string, itemId: string, userId: string): Promise<SistemaItemMembro>;
  removerItem(sistemaId: string, itemId: string): Promise<void>;
}
