---
name: spec-E09-S11-portal-deploy-separado
description: Contrato — extrair o Portal do Cliente para um deploy Netlify próprio (subdomínio) cujo bundle não contém código/rotas internas do SO; RLS continua o controle primário.
alwaysApply: true
tier: arquitetural
---

# Spec — Deploy separado do Portal do Cliente

> **Fonte da verdade.** Status: código/build implementados; site/subdomínio Netlify pendente como
> gate operacional externo pós-merge. Depende de E09-S01..S10 estáveis.
> Origem: decisão do PO — "depois vamos para um deploy separado para não ter risco do cliente
> conseguir com o acesso dele ver informações do OS".

## Resumo
O Portal do Cliente passa a ter **build e deploy próprios** (subdomínio), importando só a feature
`area-cliente/` e contratos compartilhados — nunca as telas internas do SO. A RLS por `cliente_id`
(E09-S01) continua sendo o controle primário; a separação é defesa-em-profundidade.

## Critérios de aceite

### AC-1: Build isolado do portal
- **Dado** o build do portal
- **Quando** é gerado
- **Então** o bundle **não contém** telas/rotas internas do SO (HomePage, sidebar, módulos internos);
  um gate de build falha se algum import interno vazar.

### AC-2: Deploy próprio
- **Dado** o portal
- **Quando** é publicado
- **Então** roda num deploy Netlify próprio (subdomínio dedicado), apontando ao mesmo Supabase/auth.

### AC-3: RLS permanece o controle primário
- **Dado** a separação de deploy
- **Quando** revisada
- **Então** nenhuma policy RLS foi relaxada; o isolamento por `cliente_id` (E09-S01/ADR-0011) segue
  intacto e testado.

### AC-4: Contratos compartilhados sem arrastar UI interna
- **Dado** read-models/tipos reusados pelo portal
- **Quando** movidos para `packages/`
- **Então** o portal os importa sem depender de `features/pcm/pages` internas; o SO interno continua
  funcionando.

## Fora de escopo (vinculante)
- Backend/projeto Supabase separado (mesmo backend, RLS isola).
- Mudar auth (continua local, mesmo projeto).

## Rastreabilidade
- Design: `./design.md`
- Estrutura: `apps/portal` (ou entry Vite separado) + `packages/` compartilhado; Netlify config
- Gate de build anti-vazamento de import interno
- Não altera RLS de E09-S01 (ADR-0011)
