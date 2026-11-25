// Estado de permissões por módulo — cross-feature (sidebar, tab-bar e telas de config todas
// consultam), por isso vive em app/ e não dentro de features/config/ (mesmo raciocínio de
// auth-context.tsx). A lógica de resolução real (podeAcessarModulo) é pura e vive em
// features/config/domain — este arquivo só orquestra estado de UI sobre ela.
//
// E00-S29: a busca saiu de `useState`+`useEffect` para o TanStack Query
// (features/config/application/permissoes-queries.ts). A interface pública deste módulo
// (`carregando`, `podeAcessar`) é EXATAMENTE a mesma — nenhum dos 55 consumidores muda.
// O ganho é cache: ao voltar para uma tela, a permissão já está resolvida e as consultas da
// tela partem na mesma hora, em vez de esperar uma segunda viagem.
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useRef } from "react";
import {
  permissoesQueryKeys,
  useMinhasPermissoes,
} from "../features/config/application/permissoes-queries";
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
  const autenticado = status === "autenticado";

  // Isolamento entre identidades (`permissoes-context.test.tsx`): trocar de pessoa ou de papel
  // NÃO pode reaproveitar permissão de ninguém — nem da identidade anterior, nem ao VOLTAR para
  // ela. A chave já evita servir o dado errado; esta limpeza garante que voltar para a identidade
  // anterior refaz a consulta em vez de ressuscitar o que estava em cache.
  //
  // Roda durante o render, antes de `useMinhasPermissoes` assinar, de propósito: num `useEffect`
  // haveria um frame em que o dado antigo já estaria na tela. É só limpeza de cache, idempotente,
  // e só dispara quando a identidade de fato muda.
  const cache = useQueryClient();
  const identidade = `${usuarioId ?? ""}:${papel ?? ""}`;
  const identidadeAnterior = useRef(identidade);
  if (identidadeAnterior.current !== identidade) {
    identidadeAnterior.current = identidade;
    cache.removeQueries({ queryKey: permissoesQueryKeys.minhas(undefined, undefined).slice(0, 2) });
  }

  const consulta = useMinhasPermissoes(supabaseConfigAdapter, usuarioId, papel, autenticado);

  // Falha ao resolver permissões não pode travar a Home — trata como "sem permissão nenhuma"
  // (mais restritivo, nunca mais permissivo que o real). Em erro, `data` é `undefined` e o `?? []`
  // já entrega esse comportamento; é decisão deliberada, não efeito colateral.
  const permissoes = consulta.data ?? [];

  // A identidade está DENTRO da chave da consulta, então o dado em cache nunca pode ser de outro
  // usuário ou de outro papel — era para isso que existia o state `origem` antes.
  const carregando = autenticado ? consulta.isPending : status === "carregando";

  const podeAcessar = useCallback(
    (modulo: ModuloId, nivel: NivelAcesso): boolean =>
      autenticado && !!user && podeAcessarModulo(user.papel ?? "", permissoes, modulo, nivel),
    [autenticado, permissoes, user],
  );

  return <Ctx.Provider value={{ carregando, podeAcessar }}>{children}</Ctx.Provider>;
}

export function usePermissoes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePermissoes must be inside PermissoesProvider");
  return ctx;
}
