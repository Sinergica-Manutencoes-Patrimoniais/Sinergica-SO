import type { AcaoSso } from "../domain/capacidades-sso";

export interface EnvelopeCapacidade {
  requestId: string;
  expectedRevision: number;
  motivo: string;
}
export interface DefinirConcessaoCommand extends EnvelopeCapacidade {
  usuarioId: string | null;
  perfilId: string | null;
  acao: AcaoSso;
  clienteId: string | null;
  ativa: boolean;
}
export interface DefinirPerfilCommand extends EnvelopeCapacidade {
  perfilId: string;
  nome: string;
  ativo: boolean;
}
export interface DefinirVinculoPerfilCommand extends EnvelopeCapacidade {
  usuarioId: string;
  perfilId: string;
  ativo: boolean;
}
export interface ResultadoCapacidade {
  aggregateId: string;
  revision: number;
  state: boolean;
  created: boolean;
  linkedIds: Record<string, string>;
  warnings: string[];
  requestId: string;
}
export interface PerfilCapacidade {
  id: string;
  nome: string;
  ativo: boolean;
  revisao: number;
}
export interface VinculoCapacidade {
  id: string;
  usuarioId: string;
  perfilId: string;
  ativo: boolean;
  revisao: number;
}
export interface ConcessaoCapacidade {
  id: string;
  usuarioId: string | null;
  perfilId: string | null;
  acao: AcaoSso;
  clienteId: string | null;
  ativa: boolean;
  revisao: number;
}
export interface UsuarioCapacidade {
  userId: string;
  nome: string;
  papel: string;
  ativo: boolean;
}
export interface ClienteCapacidade {
  id: string;
  nome: string;
}
export interface PaginaCapacidade {
  inicio: number;
  limite: number;
}
export interface CapacidadesSsoGateway {
  definirConcessao(input: DefinirConcessaoCommand): Promise<ResultadoCapacidade>;
  definirPerfil(input: DefinirPerfilCommand): Promise<ResultadoCapacidade>;
  definirVinculoPerfil(input: DefinirVinculoPerfilCommand): Promise<ResultadoCapacidade>;
  autorizarAcao(acao: AcaoSso, clienteId: string): Promise<boolean>;
  listarPerfis(pagina: PaginaCapacidade): Promise<PerfilCapacidade[]>;
  listarVinculos(pagina: PaginaCapacidade): Promise<VinculoCapacidade[]>;
  listarConcessoes(pagina: PaginaCapacidade): Promise<ConcessaoCapacidade[]>;
  listarUsuarios(pagina: PaginaCapacidade): Promise<UsuarioCapacidade[]>;
  listarClientes(pagina: PaginaCapacidade): Promise<ClienteCapacidade[]>;
}
