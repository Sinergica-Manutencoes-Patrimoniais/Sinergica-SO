// Estado de permissões por módulo — cross-feature (sidebar, tab-bar e telas de config todas
// consultam), por isso vive em app/ e não dentro de features/config/ (mesmo raciocínio de
// auth-context.tsx). A lógica de resolução real (podeAcessarModulo) é pura e vive em
// features/config/domain — este arquivo só orquestra estado de UI sobre ela.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { resolverMinhasPermissoes } from "../features/config/application/resolver-minhas-permissoes";
import type { PermissaoModulo } from "../features/config/domain/grupo";
import type { ModuloId, NivelAcesso } from "../features/config/domain/modulo";
import { podeAcessarModulo } from "../features/config/domain/permissao";
import { supabaseConfigAdapter } from "../features/config/infrastructure/supabase-config-adapter";
import { useAuth } from "./auth-context";

interface PermissoesCtx {
  carregando: boolean;
  podeAcessar: (modulo: ModuloId, nivel: NivelAcesso) => boolean;
}

const Ctx = createContext<PermissoesCtx | null>(null);

export function PermissoesProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const [permissoes, setPermissoes] = useState<PermissaoModulo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    if (status !== "autenticado" || !user) {
      setPermissoes([]);
      setCarregando(status === "carregando");
      return;
    }

    setCarregando(true);
    resolverMinhasPermissoes(supabaseConfigAdapter)
      .then((lista) => {
        if (ativo) setPermissoes(lista);
      })
      .catch(() => {
        // Falha ao resolver permissões não pode travar a Home — trata como "sem permissão
        // nenhuma" (mais restritivo, nunca mais permissivo que o real).
        if (ativo) setPermissoes([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [status, user]);

  const podeAcessar = useCallback(
    (modulo: ModuloId, nivel: NivelAcesso): boolean =>
      podeAcessarModulo(user?.papel ?? "", permissoes, modulo, nivel),
    [permissoes, user],
  );

  return <Ctx.Provider value={{ carregando, podeAcessar }}>{children}</Ctx.Provider>;
}

export function usePermissoes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePermissoes must be inside PermissoesProvider");
  return ctx;
}
