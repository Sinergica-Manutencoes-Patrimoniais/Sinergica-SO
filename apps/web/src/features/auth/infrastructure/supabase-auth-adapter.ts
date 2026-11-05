// Implementa AuthGateway usando @supabase/supabase-js (único ponto da feature auth que conhece
// o SDK do Supabase — ver docs/ARCHITECTURE.md, regra de dependência da camada infrastructure/).
import { supabase } from "../../../lib/supabase-client";
import type { AuthGateway, PerfilUsuario, SessaoBasica } from "../application/auth-gateway";
import { serializarAutenticacao } from "./serializar-autenticacao";

const operacoes = serializarAutenticacao(supabase.auth);

function paraSessao(user: { id: string; email?: string | null }): SessaoBasica {
  return { userId: user.id, email: user.email ?? "" };
}

export const supabaseAuthAdapter: AuthGateway = {
  async signInWithPassword(email, senha) {
    const { data, error } = await operacoes.signInWithPassword({ email, password: senha });
    if (error || !data.session) {
      throw error ?? new Error("Falha ao autenticar");
    }
    return paraSessao(data.session.user);
  },

  async signOut(usuarioEsperado) {
    await operacoes.signOut(usuarioEsperado);
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session ? paraSessao(data.session.user) : null;
  },

  async getPerfil(userId): Promise<PerfilUsuario | null> {
    const { data, error } = await supabase
      .schema("config")
      .from("usuarios")
      .select("papel, nome")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error("Não foi possível consultar o perfil. Tente novamente.");
    if (!data) return null;
    return { papel: data.papel, nome: data.nome };
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session ? paraSessao(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  },
};
