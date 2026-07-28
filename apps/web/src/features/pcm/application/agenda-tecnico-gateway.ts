import type { AlocacaoFormData, AlocacaoTecnico } from "../domain/agenda-tecnico";

export interface OpcaoFuncionario {
  id: string;
  nome: string;
}

export interface OpcaoClienteAgenda {
  id: string;
  nome: string;
}

export interface AgendaTecnicoGateway {
  listarSemana(inicioIso: string, fimIso: string): Promise<AlocacaoTecnico[]>;
  listarFuncionarios(): Promise<OpcaoFuncionario[]>;
  listarClientes(): Promise<OpcaoClienteAgenda[]>;
  criar(input: AlocacaoFormData, userId: string): Promise<AlocacaoTecnico>;
  editar(id: string, input: AlocacaoFormData, userId: string): Promise<AlocacaoTecnico>;
  remover(id: string): Promise<void>;
}
