---
name: plano-005-filtro-sem-piscar
description: Plano E00-S29/005 — keepPreviousData nas consultas cujo filtro vive na chave, para a lista não cair para vazio.
alwaysApply: false
---

# 005 — Filtro e busca não derrubam a lista para vazio

- **Status**: DONE (restam só as consultas com `gcTime: 0`, que não devem receber)
- **Commit**: cc104969
- **Severity**: MEDIUM
- **Category**: Percepção
- **Estimated scope**: queries com filtro na chave; ~8 arquivos

## Problem

O `CLAUDE.md` do projeto manda: *"Filtro/busca: `keepPreviousData` + cancelamento (resultado antigo
nunca sobrescreve filtro novo)"*. Na prática, só 6 arquivos usam `placeholderData`/`keepPreviousData`:

```
apps/web/src/features/pcm/application/operacao-queries.ts
apps/web/src/features/pcm/application/ativos-cliente-queries.ts
apps/web/src/features/pcm/interfaces/plano-manutencao/FormularioRotina.tsx
apps/web/src/features/pcm/interfaces/estrutura-tecnica/MovimentacaoDetalhe.tsx
apps/web/src/features/comercial/application/comercial-queries.ts
apps/web/src/features/comercial/pages/ContasPage.tsx
```

Em toda query cuja `queryKey` inclui um filtro, trocar o filtro cria uma chave nova, `isPending`
volta a ser `true` e a lista cai pro estado vazio antes de encher de novo. É o pisca que mais
aparece no uso diário, porque filtrar é a ação mais repetida do PCM.

## Target

Toda `useQuery` cuja chave contém filtro, busca, período ou Cliente selecionado recebe:

```ts
import { keepPreviousData } from "@tanstack/react-query";

useQuery({
  queryKey: operacaoQueryKeys.algo(filtro),
  queryFn: ({ signal }) => adapter.listar(filtro, signal),
  placeholderData: keepPreviousData,
});
```

E a `queryFn` **tem que repassar o `signal`** para o adapter, para o resultado de um filtro antigo
nunca sobrescrever o novo.

## Repo conventions to follow

- Exemplar completo no repo: `apps/web/src/features/pcm/application/operacao-queries.ts`.
- Exemplar de `queryFn` que já repassa `signal`:
  `apps/web/src/features/pcm/pages/MonitorExcecoesAuvoPage.tsx:53`
  (`queryFn: ({ signal }) => listarExcecoesAuvoT24(user?.id as string, clienteId, signal)`).
- Chaves vivem em `<dominio>QueryKeys`; não criar chave solta no componente.

## Steps

1. Levantar as queries alvo: `grep -rn "queryKey:" apps/web/src --include='*.ts*' | grep -v test`
   e selecionar as que têm filtro/busca/clienteId/período na chave e **ainda não** têm
   `placeholderData`.
2. Para cada uma, adicionar `placeholderData: keepPreviousData`.
3. Onde a `queryFn` ainda não recebe `signal`, passar a receber e repassar ao adapter. Se o
   adapter não aceitar `AbortSignal`, adicionar o parâmetro opcional — sem mudar o comportamento
   de quem não passa.
4. Onde a UI mostra "Carregando…" enquanto refaz com filtro novo, trocar o sinal por
   `isFetching` discreto (opacidade reduzida na lista), já que agora existe dado anterior na tela.

## Boundaries

- NÃO aplicar em query de detalhe de um registro (trocar de registro **deve** limpar a tela —
  mostrar o dado do anterior seria mentira).
- NÃO aplicar em mutação nem em `useInfiniteQuery` de paginação por scroll (já acumulam).
- NÃO mudar chave de cache existente.
- Fazer por domínio, um commit por domínio.

## Verification

- **Mecânica**: `pnpm --filter @sinergica/web typecheck`, `pnpm -w test` verdes.
- **Feel check**: numa tela com filtro de Cliente, trocar o Cliente várias vezes rápido. A lista
  anterior tem que continuar visível (levemente apagada) até a nova chegar, e o resultado final
  tem que corresponder **sempre** ao último filtro escolhido, nunca a um intermediário.
