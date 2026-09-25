---
name: E01-S149-propriedade-cliente-comercial-view-tasks
description: Tasks da story E01-S149
alwaysApply: false
---

# Tasks — E01-S149

## Achado
`docs/glossary.md` **já documentava corretamente** a regra ("Conta": *"O PCM exibe as ativas; o
Comercial exibe todas"*) — decisão já tinha sido tomada na E03/ADR-0020. O problema não era
documentação faltando, era o **código não seguir o que já estava escrito** (corrigido em
E01-S147). Não criei view nova nem migration — seria redundante com o filtro de aplicação já
implementado, e a spec original sugeria a view como UMA opção, não obrigatória.

## Tasks
1. `docs/glossary.md` — conferido, já correto (Conta, Lead, Oportunidade). Sem mudança necessária. ✅
2. `docs/ARCHITECTURE.md` — item 1 da "Dívida de fronteira" estava desatualizado (dizia "migram
   para E03-S01", mas nenhuma migration jamais dropou/deprecou `tipo`/`status_comercial` de
   `pcm.clientes` — colunas continuam vivas e em uso real). Corrigido pra refletir a realidade:
   enforcement é feito na camada de aplicação (filtro do E01-S147), drop físico das colunas fica
   pendente de story própria se algum dia for necessário. ✅
3. Sem view nova, sem migration — decisão consciente (evita duplicar lógica de filtro já resolvida
   no adapter).

## Validação
- Documentação lida e conferida contra o código real (não assumida).
- Nenhum código de runtime tocado nesta story.
