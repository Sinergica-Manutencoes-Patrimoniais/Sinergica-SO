---
name: tasks-E01-S80-config-so-modulos
description: Decomposição — Configurações do SO (global + por módulo).
alwaysApply: false
---

# Tasks — Configurações do SO

## Plano
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)              | Status |
|----|----------------------------------------------------------------------|----------|------------|-----------------------------|--------|
| 1  | Definir registro de "seção de config por módulo" (tipo + wiring nav) | AC-5     | —          | `pnpm test`                 | todo   |
| 2  | Hub de Config global (superadmin) agregando sub-seções existentes    | AC-1     | 1          | `pnpm test` + browser       | todo   |
| 3  | Seção "Configurações" no PCM agregando os 9 cadastros                 | AC-2     | 1          | browser (todos abrem)       | todo   |
| 4  | Remover itens movidos da sidebar operacional do PCM                  | AC-3     | 3          | browser                     | todo   |
| 5  | Remover ponto de acesso a "Categoria de produto" da navegação        | AC-4     | 3          | `grep` sem rota + browser   | todo   |
| 6  | Encaixar `AtendimentoConfigPage` no padrão (sem migrar conteúdo)     | AC-5     | 1          | browser                     | todo   |

## Plano de teste
- Unidade: registro de seções de config (ordem, gating por papel/módulo).
- Aceite: navegação — cada sub-item de config abre a página certa; sidebar operacional não lista mais
  os cadastros movidos; "categoria de produto" inacessível.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [ ] AC-1..AC-5 verdes
- [ ] `pnpm run ci:local` verde
- [ ] Playwright de navegação verde no dev server local
- [ ] `docs/STATE.md` + ROADMAP atualizados
