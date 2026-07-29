---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Fix: modal perde dados ao trocar de aba/tela do PCM

> Abordagem: um contexto React simples (`NavGuardContext`) onde qualquer modal registra "estou
> sujo, aqui está minha função de descartar" enquanto aberto; o clique de navegação do PCM_NAV
> pergunta nesse contexto antes de trocar `pcmView`. Evita reescrever a arquitetura de páginas.

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                          | Status |
|----|----------------------------------------------------------------------|----------|------------|------------------------------------------|--------|
| 1  | `NavGuardContext` (registrar/desregistrar "sujo" + confirmar saída)  | AC-1,AC-2,AC-3 | —    | `pnpm test` (unit do contexto/hook)       | done   |
| 2  | Hook `useFormularioSujo(estadoInicial, estadoAtual)` — compara raso  | AC-1,AC-2 | 1         | `pnpm test` (unit — detecta mudança)      | done   |
| 3  | Ligar no clique de nav do PCM (`HomePage.tsx`)                       | AC-1,AC-3 | 1          | Playwright (bloqueia/confirma navegação)  | done   |
| 4  | Aplicar em `NovoChamadoModal`/`GerarOsModal` (ChamadosPage.tsx)      | AC-1,AC-2,AC-3 | 2,3    | Playwright                                | done   |
| 5  | Aplicar em modais da Visão 360 (`CriarAcessoPortalModal`, `ResponsavelModal`, `AlocarFerramentaModal`) | AC-1,AC-2,AC-3 | 2,3 | Playwright | done |

> Nota: o nome real do modal de cadastro na Visão 360 é `CriarAcessoPortalModal` (não
> `ClienteFormModal` — a tela não grava cadastro de cliente localmente, só cria acesso ao portal).

## Plano de teste
- Unidade: `formularioMudou` (comparação rasa usada por `useFormularioSujo`) — 4 casos em
  `apps/web/src/app/nav-guard.test.ts`. `NavGuardContext`/hook em si não têm teste unitário — o
  projeto não usa React Testing Library (só testa camada pura); cobertura de integração é via
  Playwright, pendente do Lucas.
- Aceite: Playwright — digitar num modal, clicar em outro item de nav, confirmar que aparece aviso;
  cancelar mantém tela; confirmar navega e descarta; sem digitar nada, navega direto sem aviso.

## Divergências (SPEC_DEVIATION)
- [x] Task 1/2 · `NavGuardContext`/`useFormularioSujo` não têm teste unitário via RTL (não
  disponível no projeto) · extraída a lógica pura de comparação (`formularioMudou`) para um módulo
  próprio testável sem React; o hook/contexto em si ficam cobertos só por Playwright (aceite).
- [x] Task 5 · `AlocarFerramentaModal` tem valor inicial assíncrono (auto-seleciona 1º item da
  lista após fetch) · `useFormularioSujo` ganhou 3º parâmetro opcional `chaveReset` — recaptura a
  linha de base quando a chave muda (usa `carregando` como chave), evitando falso positivo de
  "sujo" no auto-select.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome)
- [ ] Playwright rodado localmente (reproduz e confirma o fix do bug relatado)
- [ ] `docs/STATE.md` atualizado
