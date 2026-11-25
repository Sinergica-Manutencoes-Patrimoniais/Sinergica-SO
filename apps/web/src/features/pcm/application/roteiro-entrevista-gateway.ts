import type { RoteiroEntrevista, RoteiroFormData } from "../domain/roteiro-entrevista";

export interface RoteiroEntrevistaGateway {
  listar(): Promise<RoteiroEntrevista[]>;
  criar(input: RoteiroFormData & { userId: string }): Promise<void>;
  editar(input: RoteiroFormData & { id: string; userId: string }): Promise<void>;
  alternarAtivo(input: { id: string; ativo: boolean; userId: string }): Promise<void>;
}
