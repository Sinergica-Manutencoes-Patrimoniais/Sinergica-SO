---
name: spec-E01-S95-remover-servicos-orfa
description: Contrato — remover ServicosPage.tsx órfã do PCM.
alwaysApply: true
tier: trivial
---

# Spec — Remover `ServicosPage` órfã do PCM

> **Fonte da verdade.** Status: aprovado
> Origem: apontamento de Lucas (2026-07-22), `docs/Apontamentos/Apontamentos-Fabricio-Aline.md`.
> "A aba Serviços dentro do PCM não é utilizada e deve ser removida da navegação. A integração de
> serviços com o Auvo deve continuar funcionando em segundo plano."

## Resumo
Investigação confirmou que `ServicosPage.tsx` já não está em `PCM_NAV` (`HomePage.tsx`) — nenhuma
`view: "servicos"` existe na navegação atual, e o arquivo não é importado por nenhum outro módulo
nem referenciado em specs E2E. É código morto remanescente de uma reorganização anterior de
navegação. Esta story só remove o arquivo órfão; a sincronização de Serviços com o Auvo (motor de
sync, `pcm.servicos`/descriptors) não é tocada.

## Critérios de aceite

### AC-1: Arquivo órfão removido
- **Dado** o repositório
- **Quando** buscado por `ServicosPage`
- **Então** não há nenhuma ocorrência (arquivo deletado).

### AC-2: Sync Auvo de serviços intacto
- **Dado** o motor de sync de serviços com o Auvo (tabelas/descriptors/Edge Functions)
- **Quando** esta mudança é aplicada
- **Então** nada relacionado a sync é alterado — só a página de UI órfã sai.

## Fora de escopo (vinculante)
- Qualquer mudança em schema, descriptor ou Edge Function de sync de Serviços↔Auvo.

## Rastreabilidade
- `apps/web/src/features/pcm/pages/ServicosPage.tsx` (removido)
