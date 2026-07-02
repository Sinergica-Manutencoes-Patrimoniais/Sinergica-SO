import { isPapel } from "../domain/role";
import type { UsuarioAutenticado } from "../domain/role";
import type { AuthGateway } from "./auth-gateway";

// Mensagem genérica de propósito (AC-2 do spec.md): nunca diferencia "email não existe" de
// "senha errada".
export class CredenciaisInvalidasError extends Error {
  constructor() {
    super("Usuário ou senha inválidos");
    this.name = "CredenciaisInvalidasError";
  }
}

// AC-4 do spec.md — usuário autenticado no Supabase Auth mas sem linha em config.usuarios.
export class ContaSemPerfilError extends Error {
  constructor() {
    super("Conta sem perfil configurado — contate o administrador.");
    this.name = "ContaSemPerfilError";
  }
}

export async function signIn(
  gateway: AuthGateway,
  email: string,
  senha: string,
): Promise<UsuarioAutenticado> {
  let sessao: Awaited<ReturnType<AuthGateway["signInWithPassword"]>>;
  try {
    sessao = await gateway.signInWithPassword(email, senha);
  } catch {
    throw new CredenciaisInvalidasError();
  }

  const perfil = await gateway.getPerfil(sessao.userId);
  if (!perfil || !isPapel(perfil.papel)) {
    await gateway.signOut();
    throw new ContaSemPerfilError();
  }

  return { id: sessao.userId, email: sessao.email, nome: perfil.nome, papel: perfil.papel };
}
