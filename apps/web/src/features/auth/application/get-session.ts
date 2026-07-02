import { isPapel } from "../domain/role";
import type { UsuarioAutenticado } from "../domain/role";
import type { AuthGateway } from "./auth-gateway";

export type ResultadoSessao =
  | { status: "autenticado"; usuario: UsuarioAutenticado }
  | { status: "sem-sessao" }
  // AC-4/AC-9: sessão válida no Supabase Auth, mas sem linha em config.usuarios (ou papel inválido).
  | { status: "sem-perfil" };

export async function getSession(gateway: AuthGateway): Promise<ResultadoSessao> {
  const sessao = await gateway.getSession();
  if (!sessao) return { status: "sem-sessao" };

  const perfil = await gateway.getPerfil(sessao.userId);
  if (!perfil || !isPapel(perfil.papel)) return { status: "sem-perfil" };

  return {
    status: "autenticado",
    usuario: { id: sessao.userId, email: sessao.email, nome: perfil.nome, papel: perfil.papel },
  };
}
