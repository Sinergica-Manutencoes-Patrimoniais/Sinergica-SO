---
name: plano-004-moldura-persistente
description: Plano E00-S29/004 — esqueleto só na região de dados; cabeçalho, filtros e abas deixam de sumir a cada carregamento.
alwaysApply: false
---

# 004 — Moldura persistente: skeleton na região, nunca na página inteira

- **Status**: DONE
- **Commit**: cc104969
- **Severity**: HIGH
- **Category**: Percepção
- **Estimated scope**: as telas de maior tráfego, começando por `OrdensServicoPage.tsx`; ~4 arquivos

## Problem

Três defeitos somados na mesma tela, a mais usada do sistema.

**1. Troca de página inteira.** `OrdensServicoPage.tsx:592`:

```tsx
// apps/web/src/features/pcm/pages/OrdensServicoPage.tsx:591-593 — atual
  if (feedPendente) {
    return <SkeletonOperacao />;
  }
```

Cabeçalho, filtros e abas somem e voltam. Há 22 `return` desses no `apps/web/src`.

**2. Dois skeletons de formas diferentes em sequência.** Antes do de cima, há outro:

```tsx
// apps/web/src/features/pcm/pages/OrdensServicoPage.tsx:570-578 — atual
  if (permissoesCarregando) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }
```

O usuário vê: três barrinhas → `SkeletonOperacao` (outra forma) → conteúdo. Três layouts
distintos piscando em sequência.

**3. O anti-flash existe e não é usado.** `packages/ui/src/use-carga-visivel.ts` implementa a
regra certa (não mostra antes de 200ms; uma vez mostrado, segura 400ms) e **só o `DataTable` o
consome** (`packages/ui/src/DataTable.tsx`). Nenhum dos skeletons de página passa por ele, então
em requisição rápida eles aparecem e somem num piscar.

## Target

A moldura da tela — cabeçalho, filtros, abas — fica montada o tempo inteiro. Só a região de dados
troca, e a troca passa pelo anti-flash.

O exemplar correto já existe no repo, em `MonitorExcecoesAuvoPage.tsx:69-95`: o `<h1>`, a
descrição e o `<select>` de Cliente são renderizados incondicionalmente, e só o bloco da tabela
depende do estado da query.

```tsx
// target — forma geral
const mostrarEsqueleto = useCargaVisivel(feedPendente);

return (
  <div className="flex flex-col gap-4">
    <CabecalhoOperacao … />        {/* sempre montado */}
    <FiltrosOperacao … />          {/* sempre montado */}
    {mostrarEsqueleto ? <SkeletonOperacao /> : <ConteudoOperacao … />}
  </div>
);
```

O gate de permissão deixa de ter skeleton próprio: com o plano 002 a permissão resolve do cache,
e enquanto não resolveu a moldura já pode ser pintada. Só o bloco de dados espera.

## Repo conventions to follow

- `useCargaVisivel` é exportado por `@sinergica/ui` (`packages/ui/src/index.ts`).
- Exemplar de moldura persistente: `apps/web/src/features/pcm/pages/MonitorExcecoesAuvoPage.tsx:69-95`.
- Exemplar de uso do anti-flash: `packages/ui/src/DataTable.tsx` (`const mostrarCarregando = useCargaVisivel(carregando ?? false)`).
- `Skeleton` tem que ter a forma do conteúdo real — está escrito no próprio
  `packages/ui/src/Skeleton.tsx`: "forma do conteúdo real, nunca spinner centralizado".

## Steps

1. Em `OrdensServicoPage.tsx`, extrair o cabeçalho e a barra de filtros para fora dos `return`
   antecipados, de modo que fiquem sempre renderizados.
2. Remover o `if (permissoesCarregando) return (…)` das linhas 570-578. A moldura passa a ser
   pintada mesmo sem permissão resolvida; o bloco de dados usa o mesmo caminho de esqueleto.
3. Trocar `if (feedPendente) return <SkeletonOperacao />` por render condicional **dentro** da
   moldura, usando `const mostrarEsqueleto = useCargaVisivel(feedPendente)`.
4. Manter o `return` antecipado de `!temLeitura` ("Acesso restrito") — esse é estado final, não
   carregamento, e deve continuar substituindo a tela.
5. Repetir o mesmo padrão nas outras telas com `return` de página inteira em `isPending`, na
   ordem de tráfego. Fazer uma tela por commit.

## Boundaries

- NÃO mudar nenhuma query, chave de cache, RPC ou regra de permissão.
- NÃO mexer no `SkeletonOperacao` em si nesta etapa (a forma dele já corresponde ao conteúdo).
- NÃO remover o `return` de "Acesso restrito" nem o de erro — só os de carregamento.
- NÃO converter as 22 ocorrências de uma vez: uma tela por commit, começando pela
  `OrdensServicoPage`.
- Se o cabeçalho e os filtros estiverem entrelaçados com estado que só existe depois do dado,
  PARE e relate em vez de reorganizar o componente inteiro.

## Verification

- **Mecânica**: `pnpm --filter @sinergica/web typecheck`, `pnpm -w lint`, `pnpm -w test` verdes.
  Os testes de `OrdensServicoPage` continuam passando sem alteração de asserção — se precisarem
  mudar, é sinal de que o comportamento mudou além do pretendido.
- **Feel check**: com rede normal, abrir o Kanban. O cabeçalho e os filtros têm que aparecer de
  imediato e **não sumir mais**. Em requisição rápida (cache quente) nenhum esqueleto pode
  aparecer. Com throttling "Slow 3G", o esqueleto aparece uma vez só, na região da lista, e
  permanece visível por pelo menos 400ms.
