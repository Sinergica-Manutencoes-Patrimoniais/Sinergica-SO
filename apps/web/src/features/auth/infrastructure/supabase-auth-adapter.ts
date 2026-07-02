// Implementa AuthGateway usando @supabase/supabase-js (único ponto da feature auth que conhece
// o SDK do Supabase — ver docs/ARCHITECTURE.md, regra de dependência da camada infrastructure/).
import { supabase } from "../../../lib/supabase-client";
import type { AuthGateway, PerfilUsuario, SessaoBasica } from "../application/auth-gateway";

function paraSessao(user: { id: string; email?: string | null }): SessaoBasica {
  return { userId: user.id, email: user.email ?? "" };
}

export const supabaseAuthAdapter: AuthGateway = {
  async signInWithPassword(email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.session) {
      throw error ?? new Error("Falha ao autenticar");
    }
    return paraSessao(data.session.user);
  },

  async signOut() {
    await supabase.auth.signOut();
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

    if (error || !data) return null;
    return { papel: data.papel, nome: data.nome };
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session ? paraSessao(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  },
};
