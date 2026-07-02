// Estado de sessão transversal — consumido pelo shell/roteamento de toda a app (guard de rota é
// preocupação cross-feature, por isso vive em app/ e não dentro de features/auth/ — ver
// specs/E00-S05-autenticacao-autorizacao/design.md).
// A lógica de autenticação real vive em features/auth/application; este arquivo só orquestra
// estado de UI (loading, usuário atual, erro de sessão) sobre os casos de uso.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSession } from "../features/auth/application/get-session";
import { signIn } from "../features/auth/application/sign-in";
import { signOut } from "../features/auth/application/sign-out";
import type { UsuarioAutenticado } from "../features/auth/domain/role";
import { supabaseAuthAdapter } from "../features/auth/infrastructure/supabase-auth-adapter";

export type StatusSessao = "carregando" | "autenticado" | "nao-autenticado";

interface AuthCtx {
  user: UsuarioAutenticado | null;
  status: StatusSessao;
  /** Mensagem de erro de sessão restaurada sem perfil (AC-4) — lida uma vez pelo LoginPage. */
  erroSessao: string | null;
  limparErroSessao: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UsuarioAutenticado | null>(null);
  const [status, setStatus] = useState<StatusSessao>("carregando");
  const [erroSessao, setErroSessao] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    const resolverSessaoAtual = async () => {
      const resultado = await getSession(supabaseAuthAdapter);
      if (!ativo) return;

      if (resultado.status === "autenticado") {
        setUser(resultado.usuario);
        setStatus("autenticado");
        return;
      }

      if (resultado.status === "sem-perfil") {
        await supabaseAuthAdapter.signOut();
        if (!ativo) return;
        setErroSessao("Conta sem perfil configurado — contate o administrador.");
      }

      setUser(null);
      setStatus("nao-autenticado");
    };

    resolverSessaoAtual();

    // Reage a mudanças externas de sessão (outra aba, expiração, refresh de token). Quando ainda
    // há sessão, resolve o perfil de novo (não só checa presença) — sem isso, papel/nome ficam
    // desatualizados na UI se config.usuarios mudar/for removido enquanto a sessão está viva, e
    // um perfil removido no meio da sessão nunca seria detectado até um reload manual.
    const unsubscribe = supabaseAuthAdapter.onAuthStateChange((sessao) => {
      if (!ativo) return;
      if (!sessao) {
        setUser(null);
        setStatus("nao-autenticado");
        return;
      }
      resolverSessaoAtual();
    });

    return () => {
      ativo = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const usuario = await signIn(supabaseAuthAdapter, email, password);
    setUser(usuario);
    setStatus("autenticado");
  }, []);

  const logout = useCallback(() => {
    signOut(supabaseAuthAdapter);
    setUser(null);
    setStatus("nao-autenticado");
  }, []);

  const limparErroSessao = useCallback(() => setErroSessao(null), []);

  return (
    <Ctx.Provider value={{ user, status, erroSessao, limparErroSessao, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
