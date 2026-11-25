# 006 — Polimento: esqueleto com a forma certa e entrada do conteúdo

- **Status**: TODO
- **Commit**: cc104969
- **Severity**: LOW
- **Category**: Coesão / Movimento
- **Estimated scope**: 2 arquivos, ~30 linhas

## Problem

**1. Esqueleto que não tem a forma do conteúdo.** O monitor mostra uma barrinha fina onde vai
nascer uma tabela de oito colunas:

```tsx
// apps/web/src/features/pcm/pages/MonitorExcecoesAuvoPage.tsx — atual
{ligada && clienteId && excecoes.isPending ? <Skeleton className="h-4 w-48" /> : null}
```

Isso contradiz a regra escrita no próprio primitivo (`packages/ui/src/Skeleton.tsx`: "forma do
conteúdo real, nunca spinner centralizado") e faz o layout saltar quando a tabela chega.

**2. Troca dura entre esqueleto e conteúdo.** Não há transição nenhuma: o esqueleto some e o
conteúdo aparece no mesmo frame. Com os tokens que o projeto já tem, um fade curto custa nada e
tira o solavanco.

## Target

1. O monitor usa o `carregando` do próprio `DataTable` (que já desenha linhas fantasma na largura
   real das colunas) em vez do `Skeleton` solto:

```tsx
// target
<DataTable
  carregando={excecoes.isPending}
  linhasCarregando={5}
  …
/>
```

2. Uma utilitária de entrada, usando os tokens existentes:

```css
/* apps/web/src/index.css — target, dentro de @layer utilities */
@keyframes conteudo-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.anim-conteudo {
  animation: conteudo-in var(--duration-fast) var(--ease-out);
}
```

`--duration-fast` é 120ms e `--ease-out` é `cubic-bezier(0.23, 1, 0.32, 1)` — ambos já definidos
em `apps/web/src/index.css:82-87`. Só opacidade: nada de `translate` ou `scale`, porque a lista
já está no lugar certo e mover seria movimento sem propósito.

## Repo conventions to follow

- Tokens de movimento em `apps/web/src/index.css:82-87`. **Não criar curva nem duração nova.**
- Animação é CSS puro, sem biblioteca (ADR-0018).
- A rede de `prefers-reduced-motion` em `index.css:164-172` já zera qualquer `animation-duration`
  do projeto — a utilitária nova é coberta automaticamente, não precisa de override próprio.
- O `DataTable` já aceita `carregando` e `linhasCarregando` (`packages/ui/src/DataTable.tsx`).

## Steps

1. Em `MonitorExcecoesAuvoPage.tsx`, remover o `<Skeleton className="h-4 w-48" />` e passar
   `carregando={excecoes.isPending}` ao `DataTable`. Ajustar a condição que hoje só renderiza a
   tabela quando `lista.length > 0`, para que o estado de carregamento também chegue ao
   `DataTable`.
2. Em `apps/web/src/index.css`, adicionar `@keyframes conteudo-in` e `.anim-conteudo` dentro do
   `@layer utilities` existente.
3. Aplicar `.anim-conteudo` no bloco de conteúdo que substitui o esqueleto nas telas tocadas pelo
   plano 004.

## Boundaries

- NÃO criar token de easing ou duração novo.
- NÃO animar `transform` aqui — só opacidade.
- NÃO aplicar a utilitária em elemento que remonta a cada tecla digitada (animaria a cada
  caractere).
- NÃO mexer nas animações de modal/overlay — já estão corretas e documentadas (ADR-0018).

## Verification

- **Mecânica**: `node scripts/check-movimento.mjs` continua verde (0 `transition-all`, 0
  biblioteca de animação); `pnpm -w test` verde.
- **Feel check**: abrir o monitor e trocar de Cliente. As linhas fantasma devem ter a largura das
  colunas reais, e a tabela real deve entrar sem salto de layout. Com "Reduzir movimento" ligado
  no sistema, o fade não deve existir — o conteúdo aparece direto.
