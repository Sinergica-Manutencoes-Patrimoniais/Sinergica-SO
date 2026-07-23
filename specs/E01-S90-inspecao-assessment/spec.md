---
name: spec-E01-S90-inspecao-assessment
description: Contrato — Inspeção como documento de assessment do cliente; questionário Auvo → itens; cada item deriva Chamado/Backlog/OS com responsável (Sinérgica/terceiro/cliente).
alwaysApply: true
tier: arquitetural
---

# Spec — Inspeção como assessment do cliente

> **Fonte da verdade.** Status: aprovado (após `design.md`)
> Origem: reunião Lucas × Fabrício (2026-07-16), item 4.1. Depende de `./design.md`, de E01-S88
> (Chamado) e E01-S83 (Backlog).

## Resumo
A Inspeção passa a ser o **documento de assessment do cliente** (início/alteração/anual), montado a
partir de um **questionário do Auvo**: cada resposta vira um **item de inspeção** (com imagens), e
cada item deriva para **Chamado, Backlog ou OS**, com responsável definido (Sinérgica executa /
terceiriza / cliente resolve).

## Critérios de aceite

### AC-1: Inspeção-assessment por cliente/contrato
- **Dado** um cliente/contrato
- **Quando** o usuário abre uma inspeção-assessment (motivo: início / alteração / anual)
- **Então** ela é criada ligada ao cliente, com data e motivo, distinta de uma inspeção ABNT comum.

### AC-2: Questionário Auvo → itens
- **Dado** um questionário preenchido no Auvo (respostas + imagens) chegando via snapshot (E01-S15)
- **Quando** é processado
- **Então** cada resposta vira um **item de inspeção** no PCM (idempotente por questão), com as
  imagens referenciadas; respostas não mapeadas nunca se perdem (item "a classificar").

### AC-3: Item deriva Chamado / Backlog / OS com responsável
- **Dado** um item de inspeção
- **Quando** o usuário decide o destino
- **Então** pode gerar **Chamado** (E01-S88), enviar ao **Backlog** (E01-S83) ou gerar **OS**,
  registrando o responsável (Sinérgica / terceiro / cliente) e mantendo rastreio ao item de origem.

### AC-4: Assessment visível na Visão 360
- **Dado** a Visão 360 do Cliente
- **Quando** o usuário abre o cliente
- **Então** vê a inspeção-assessment vigente como documento de estado (itens + destinos), ligando
  inspeção↔cliente de fato.

## Casos de borda e erros
- Reprocessar o mesmo questionário → não duplica itens (idempotência por inspeção+questão).
- Item já derivado → não permite derivar de novo pro mesmo destino sem intenção clara.
- Imagem ausente/URL Auvo → item existe mesmo sem mídia.

## Fora de escopo (vinculante)
- Portal do Cliente abrindo/visualizando o assessment (é E09/futuro; aqui só a Visão 360 interna).
- Geração de laudo/PDF do assessment (pode ser story futura, reusa padrão E01-S05).
- Reescrever Inspeções ABNT (E01-S73) — assessment é tipo separado.

## Rastreabilidade
- Design: `./design.md`
- Migration: tipo/entidade de inspeção-assessment + itens (destino, responsável)
- Mapeador questionário Auvo → itens: reusa `pcm.auvo_task_snapshots` (E01-S15)
- `apps/web/src/features/pcm/pages/InspecoesPage.tsx`, `domain/inspecoes-laudos.ts`,
  `infrastructure/supabase-qualidade-adapter.ts`, `application/qualidade-gateway.ts`
- Visão 360: `VisaoClientePage.tsx` + `cliente-360-gateway.ts`
- Integra: Chamado (E01-S88), Backlog (E01-S83)
