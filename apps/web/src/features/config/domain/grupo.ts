// Agregado Grupo — regra pura, sem I/O (ver specs/E00-S09-grupos-permissao-modulo/domain.md).
import type { ModuloId, NivelAcesso } from "./modulo";

export interface PermissaoModulo {
  modulo: ModuloId;
  nivel: NivelAcesso;
}

export interface Grupo {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  permissoes: PermissaoModulo[];
}
