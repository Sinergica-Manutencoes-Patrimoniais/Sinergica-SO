// E00-S29 — permissão de módulo pelo TanStack Query.
//
// Antes isto era `useState` + `useEffect` dentro do `PermissoesProvider` — o padrão que o
// CLAUDE.md recusa em código novo. Sem passar pelo `queryClient` não havia cache, `staleTime`,
// dedupe nem revalidação, e 55 telas penduravam o `enabled` das próprias consultas no
// `carregando` dele: duas viagens em série antes de qualquer dado aparecer.
//
// A chave inclui `usuarioId` e `papel` de propósito: é o que garante que o dado em cache nunca
// seja de outra identidade, sem precisar de um state `origem` paralelo comparando quem pediu.
import { useQuery } from "@tanstack/react-query";
import type { PermissaoModulo } from "../domain/grupo";
import type { ConfigGateway } from "./config-gateway";
import { resolverMinhasPermissoes } from "./resolver-minhas-permissoes";

export const permissoesQueryKeys = {
  minhas: (usuarioId: string | undefined, papel: string | undefined) =>
    ["config", "minhas-permissoes", usuarioId, papel] as const,
};

// `staleTime` alto porque permissão muda raramente. Revogação com urgência NÃO depende deste
// cache: E00-S27 derruba a sessão na próxima ação, pelo servidor — o cliente nunca é a barreira.
const CINCO_MINUTOS = 5 * 60 * 1000;
const MEIA_HORA = 30 * 60 * 1000;

// `application/` não importa `infrastructure/` (regra do dependency-cruiser) — quem injeta o
// gateway é a borda, igual `agenda-projecao-queries.ts` já faz.
export function useMinhasPermissoes(
  gateway: ConfigGateway,
  usuarioId: string | undefined,
  papel: string | undefined,
  habilitado: boolean,
) {
  return useQuery<PermissaoModulo[]>({
    queryKey: permissoesQueryKeys.minhas(usuarioId, papel),
    queryFn: () => resolverMinhasPermissoes(gateway),
    enabled: habilitado && Boolean(usuarioId) && Boolean(papel),
    staleTime: CINCO_MINUTOS,
    gcTime: MEIA_HORA,
    retry: 1,
  });
}
