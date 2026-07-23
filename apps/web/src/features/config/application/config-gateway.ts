// Porta (interface) que a infrastructure implementa. A application só conhece este contrato —
// nunca importa @supabase/supabase-js diretamente (ver docs/ARCHITECTURE.md — application/).
import type { Grupo, PermissaoModulo } from "../domain/grupo";

export interface UsuarioConfig {
  userId: string;
  nome: string;
  papel: string; // validado pelo chamador — pode vir vazio/inválido do banco
  ativo: boolean;
  modo: ModoPermissaoUsuario;
}

export type ModoPermissaoUsuario =
  | { tipo: "grupo"; grupoId: string; grupoNome: string | null }
  | { tipo: "individual"; permissoes: PermissaoModulo[] };

// Modo de permissão enviado pela UI — sem grupoNome (resolvido pelo servidor), mutuamente
// exclusivo por construção do discriminated union (nunca os dois presentes ao mesmo tempo).
export type ModoPermissaoInput =
  | { tipo: "grupo"; grupoId: string }
  | { tipo: "individual"; permissoes: PermissaoModulo[] };

export interface CriarUsuarioInput {
  email: string;
  senha: string;
  nome: string;
  papel: string;
  modo: ModoPermissaoInput;
  /** E09-S01: obrigatório para cliente-sindico; omitido para papéis internos. */
  clienteId?: string;
}

export interface PatchGrupo {
  nome?: string;
  descricao?: string | null;
  ativo?: boolean;
  permissoes?: PermissaoModulo[];
}

export interface ConfigGateway {
  /** Permissões resolvidas do usuário autenticado (config.minhas_permissoes). */
  minhasPermissoes(): Promise<PermissaoModulo[]>;
  listarGrupos(): Promise<Grupo[]>;
  criarGrupo(nome: string, descricao: string | null, permissoes: PermissaoModulo[]): Promise<Grupo>;
  editarGrupo(id: string, patch: PatchGrupo): Promise<Grupo>;
  listarUsuarios(): Promise<UsuarioConfig[]>;
  /** Chama a Edge Function config-gerenciar-usuario (cria Auth user + perfil + permissão inicial). */
  criarUsuario(input: CriarUsuarioInput): Promise<{ userId: string }>;
  /** Troca de modo atômica via config.definir_permissao_usuario — nunca duas escritas separadas. */
  definirPermissaoUsuario(userId: string, modo: ModoPermissaoInput): Promise<void>;
  /** Preview admin das permissões resolvidas de outro usuário (config.resolver_permissoes_modulo). */
  resolverPermissoesDe(userId: string): Promise<PermissaoModulo[]>;
}
