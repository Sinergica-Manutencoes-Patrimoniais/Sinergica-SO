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
  const usuarioId = user?.id;
  const papel = user?.papel;
  const [permissoes, setPermissoes] = useState<PermissaoModulo[]>([]);
  const [origem, setOrigem] = useState<{ id: string; papel: string } | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    if (status !== "autenticado" || !usuarioId || !papel) {
      setPermissoes([]);
      setOrigem(null);
      setCarregando(status === "carregando");
      return;
    }

    setCarregando(true);
    setOrigem(null);
    const identidade = { id: usuarioId, papel };
    resolverMinhasPermissoes(supabaseConfigAdapter)
      .then((lista) => {
        if (ativo) {
          setPermissoes(lista);
          setOrigem(identidade);
        }
      })
      .catch(() => {
        // Falha ao resolver permissões não pode travar a Home — trata como "sem permissão
        // nenhuma" (mais restritivo, nunca mais permissivo que o real).
        if (ativo) {
          setPermissoes([]);
          setOrigem(identidade);
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [status, usuarioId, papel]);

  const corresponde =
    status === "autenticado" && !!user && origem?.id === user.id && origem.papel === user.papel;

  const podeAcessar = useCallback(
    (modulo: ModuloId, nivel: NivelAcesso): boolean =>
      corresponde && podeAcessarModulo(user?.papel ?? "", permissoes, modulo, nivel),
    [corresponde, permissoes, user],
  );

  return (
    <Ctx.Provider
      value={{ carregando: carregando || (status === "autenticado" && !corresponde), podeAcessar }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePermissoes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePermissoes must be inside PermissoesProvider");
  return ctx;
}
