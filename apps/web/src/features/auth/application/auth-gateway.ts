// Porta (interface) que a infrastructure implementa. A application só conhece este contrato —
// nunca importa @supabase/supabase-js diretamente (ver docs/ARCHITECTURE.md — application/).
import type { Papel } from "../domain/role";

export interface SessaoBasica {
  userId: string;
  email: string;
}

export interface PerfilUsuario {
  papel: string; // validado com isPapel() pelo chamador — pode vir inválido/vazio do banco
  nome: string;
}

export interface AuthGateway {
  signInWithPassword(email: string, senha: string): Promise<SessaoBasica>;
  signOut(): Promise<void>;
  getSession(): Promise<SessaoBasica | null>;
  /** Retorna null quando não há linha em config.usuarios para o userId (perfil ausente). */
  getPerfil(userId: string): Promise<PerfilUsuario | null>;
  /** Retorna a função de unsubscribe. */
  onAuthStateChange(callback: (sessao: SessaoBasica | null) => void): () => void;
}

export type { Papel };
