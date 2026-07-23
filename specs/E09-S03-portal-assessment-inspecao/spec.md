---
name: spec-E09-S03-portal-assessment-inspecao
description: Contrato — no Portal do Cliente, consultar o documento de assessment/inspeção do condomínio (read-only), reusando a inspeção-assessment de E01-S90.
alwaysApply: true
tier: pequeno
---

# Spec — Assessment/Inspeção no portal (consulta)

> **Fonte da verdade.** Status: aprovado. Depende de E09-S01 e **E01-S90** (inspeção-assessment).

## Resumo
O síndico consulta, no portal, o **documento de assessment/inspeção** do seu condomínio — o estado
do imóvel (itens levantados + fotos), read-only, escopado ao `cliente_id`.

## Contexto atual (AS-IS)
- Inspeção-assessment modelada em E01-S90 (questionário Auvo → itens → destino), visível na Visão 360
  interna. Aqui expomos a **consulta** ao síndico no portal.

## Critérios de aceite

### AC-1: Consultar assessment do próprio condomínio
- **Dado** um síndico logado
- **Quando** abre a seção Assessment/Inspeção
- **Então** vê o(s) documento(s) de assessment do **seu** condomínio (data, motivo, itens com
  fotos), somente leitura, escopado por RLS `cliente_id`.

### AC-2: Sem dados internos de decisão
- **Dado** o assessment tem itens com destino/responsável (Sinérgica/terceiro/cliente) — E01-S90
- **Quando** o síndico visualiza
- **Então** vê o estado/condição de cada item e, se aplicável, o responsável pela ação; **não** vê
  notas internas de custo/priorização interna.

### AC-3: Fotos por signed URL
- **Dado** itens com mídia (bucket privado)
- **Quando** o síndico abre a foto
- **Então** ela é servida por signed URL temporária (padrão de Storage do projeto), sem expor o
  bucket.

### AC-4: Sem assessment
- **Dado** condomínio sem assessment
- **Quando** a seção abre
- **Então** estado vazio claro ("nenhum assessment disponível").

## Fora de escopo (vinculante)
- Editar/derivar itens (é ação interna, E01-S90).
- Gerar PDF do assessment (fica na Central de Documentos E09-S06 se/quando existir o PDF).

## Rastreabilidade
- `apps/web/src/features/area-cliente/` (seção Assessment)
- Reusa modelo/adapter de E01-S90 (RLS por `cliente_id` estendida às tabelas de assessment)
- Storage signed URL: padrão `urlAssinadaMidia` (`supabase-qualidade-adapter.ts`)
