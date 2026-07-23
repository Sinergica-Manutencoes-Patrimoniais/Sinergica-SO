import type { MarcacaoCliente, MarcacaoClienteFormData } from "../domain/marcacoes-cliente";

export interface CriarMarcacaoCommand extends MarcacaoClienteFormData {
  userId: string;
}

export interface EditarMarcacaoCommand extends CriarMarcacaoCommand {
  id: string;
}

export interface MarcacoesClienteGateway {
  listar(): Promise<MarcacaoCliente[]>;
  criar(input: CriarMarcacaoCommand): Promise<MarcacaoCliente>;
  editar(input: EditarMarcacaoCommand): Promise<MarcacaoCliente>;
  /** AC-3/casos de borda: FK sem `on delete` bloqueia sozinha a exclusão de marcação em uso — o
   * adapter traduz o 23503 numa mensagem amigável, não é regra de aplicação. */
  excluir(id: string): Promise<void>;
  /** AC-2: define/troca a marcação vigente do cliente — `null` remove a marcação. */
  definirMarcacaoCliente(
    clienteId: string,
    marcacaoId: string | null,
    userId: string,
  ): Promise<void>;
}
