// Estado de sessão transversal — consumido pelo shell/roteamento de toda a app (guard de rota é
// preocupação cross-feature, por isso vive em app/ e não dentro de features/auth/ — ver
// specs/E00-S05-autenticacao-autorizacao/design.md).
// A lógica de autenticação real vive em features/auth/application; este arquivo só orquestra
// estado de UI (loading, usuário atual, erro de sessão) sobre os casos de uso.
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getSession } from "../features/auth/application/get-session";
import { signIn } from "../features/auth/application/sign-in";
import { signOut } from "../features/auth/application/sign-out";
import { type UsuarioAutenticado, mesmoUsuario } from "../features/auth/domain/role";
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
  const queryClient = useQueryClient();
  const identidade = useRef<UsuarioAutenticado | null>(null);
  const geracao = useRef(0);
  const resolucaoAtual = useRef<Promise<void> | null>(null);
  const cancelarEspera = useRef<(() => void) | null>(null);
  const [user, setUser] = useState<UsuarioAutenticado | null>(null);
  const [status, setStatus] = useState<StatusSessao>("carregando");
  const [erroSessao, setErroSessao] = useState<string | null>(null);

  const aplicarUsuario = useCallback(
    (novo: UsuarioAutenticado | null) => {
      const anterior = identidade.current;
      if (anterior?.id !== novo?.id || anterior?.papel !== novo?.papel) queryClient.clear();
      identidade.current = novo;
      setUser((atual) => (mesmoUsuario(atual, novo) ? atual : novo));
    },
    [queryClient],
  );

  useEffect(() => {
    let ativo = true;
    // Um provider remontado não conhece a identidade que preencheu o cache anterior.
    queryClient.clear();

    const resolverSessaoAtual = async (usuarioEsperado?: string) => {
      const atual = ++geracao.current;
      try {
        const resultado = await getSession(supabaseAuthAdapter);
        if (!ativo || atual !== geracao.current) return;

        if (resultado.status === "autenticado") {
          if (usuarioEsperado && resultado.usuario.id !== usuarioEsperado) {
            aplicarUsuario(null);
            setStatus("nao-autenticado");
            setErroSessao("A sessão mudou durante a autenticação. Tente entrar novamente.");
            return;
          }
          // Mantém a mesma referência quando o perfil resolvido é idêntico ao atual — evita
          // re-render em cascata (ex.: PermissoesProvider) a cada revalidação silenciosa de
          // sessão (token renovado ao voltar o foco da aba), que não muda nada de verdade.
          aplicarUsuario(resultado.usuario);
          setStatus("autenticado");
          return;
        }

        if (resultado.status === "sem-perfil") {
          setErroSessao("Conta sem perfil configurado — contate o administrador.");
          await supabaseAuthAdapter.signOut(resultado.userId);
          if (!ativo || atual !== geracao.current) return;
        }

        aplicarUsuario(null);
        setStatus("nao-autenticado");
      } catch {
        if (!ativo || atual !== geracao.current) return;
        aplicarUsuario(null);
        setStatus("nao-autenticado");
        setErroSessao("Não foi possível restaurar a sessão. Tente entrar novamente.");
      }
    };

    const iniciarResolucao = (usuarioEsperado?: string) => {
      cancelarEspera.current?.();
      const interrompida = new Promise<void>((resolve) => {
        cancelarEspera.current = resolve;
      });
      resolucaoAtual.current = Promise.race([resolverSessaoAtual(usuarioEsperado), interrompida]);
    };
    iniciarResolucao();

    // Reage a mudanças externas de sessão (outra aba, expiração, refresh de token). Quando ainda
    // há sessão, resolve o perfil de novo (não só checa presença) — sem isso, papel/nome ficam
    // desatualizados na UI se config.usuarios mudar/for removido enquanto a sessão está viva, e
    // um perfil removido no meio da sessão nunca seria detectado até um reload manual.
    const unsubscribe = supabaseAuthAdapter.onAuthStateChange((sessao) => {
      if (!ativo) return;
      if (!sessao) {
        ++geracao.current;
        cancelarEspera.current?.();
        cancelarEspera.current = null;
        resolucaoAtual.current = null;
        aplicarUsuario(null);
        setStatus("nao-autenticado");
        return;
      }
      if (identidade.current && identidade.current.id !== sessao.userId) {
        aplicarUsuario(null);
        setStatus("carregando");
      }
      iniciarResolucao(sessao.userId);
    });

    return () => {
      ativo = false;
      ++geracao.current;
      cancelarEspera.current?.();
      cancelarEspera.current = null;
      resolucaoAtual.current = null;
      unsubscribe();
    };
  }, [aplicarUsuario, queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const atual = ++geracao.current;
      const usuario = await signIn(supabaseAuthAdapter, email, password);
      if (atual !== geracao.current) {
        await resolucaoAtual.current;
        return;
      }
      aplicarUsuario(usuario);
      setStatus("autenticado");
    },
    [aplicarUsuario],
  );

  const logout = useCallback(() => {
    const atual = ++geracao.current;
    cancelarEspera.current?.();
    cancelarEspera.current = null;
    resolucaoAtual.current = null;
    void signOut(supabaseAuthAdapter).catch(() => {
      if (atual === geracao.current) {
        setErroSessao(
          "Não foi possível encerrar a sessão no servidor. Tente entrar e sair novamente.",
        );
      }
    });
    aplicarUsuario(null);
    setStatus("nao-autenticado");
  }, [aplicarUsuario]);

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
