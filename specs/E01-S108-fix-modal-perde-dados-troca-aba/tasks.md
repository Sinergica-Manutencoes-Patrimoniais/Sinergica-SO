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
| 1  | `NavGuardContext` (registrar/desregistrar "sujo" + confirmar saída)  | AC-1,AC-2,AC-3 | —    | `pnpm test` (unit do contexto/hook)       | todo   |
| 2  | Hook `useFormularioSujo(estadoInicial, estadoAtual)` — compara raso  | AC-1,AC-2 | 1         | `pnpm test` (unit — detecta mudança)      | todo   |
| 3  | Ligar no clique de nav do PCM (`HomePage.tsx`)                       | AC-1,AC-3 | 1          | Playwright (bloqueia/confirma navegação)  | todo   |
| 4  | Aplicar em `NovoChamadoModal`/`GerarOsModal` (ChamadosPage.tsx)      | AC-1,AC-2,AC-3 | 2,3    | Playwright                                | todo   |
| 5  | Aplicar em modais da Visão 360 (`ClienteFormModal`, `ResponsavelModal`, `AlocarFerramentaModal`) | AC-1,AC-2,AC-3 | 2,3 | Playwright | todo |

## Plano de teste
- Unidade: `useFormularioSujo` detecta diff entre estado inicial e atual; `NavGuardContext`
  registra/limpa corretamente ao montar/desmontar.
- Aceite: Playwright — digitar num modal, clicar em outro item de nav, confirmar que aparece aviso;
  cancelar mantém tela; confirmar navega e descarta; sem digitar nada, navega direto sem aviso.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Playwright rodado localmente (reproduz e confirma o fix do bug relatado)
- [ ] `docs/STATE.md` atualizado
