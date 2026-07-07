import type { ClienteGrupoFormData, ClienteGrupoItem } from "../domain/cliente-grupos";
import type { ClienteResumo } from "./cliente-360-gateway";

export interface ClienteGrupoCommand extends ClienteGrupoFormData {
  userId: string;
}

export interface EditarClienteGrupoCommand extends ClienteGrupoCommand {
  id: string;
}

export interface ExcluirClienteGrupoCommand {
  id: string;
  userId: string;
}

export interface ClienteGruposGateway {
  listar(): Promise<ClienteGrupoItem[]>;
  listarClientesSincronizados(): Promise<ClienteResumo[]>;
  criar(input: ClienteGrupoCommand): Promise<ClienteGrupoItem>;
  editar(input: EditarClienteGrupoCommand): Promise<ClienteGrupoItem>;
  excluir(input: ExcluirClienteGrupoCommand): Promise<void>;
}
