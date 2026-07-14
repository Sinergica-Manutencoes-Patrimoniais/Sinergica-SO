---
name: spec
description: Contrato — capturar e exibir a imagem e os anexos dos equipamentos vindos do Auvo (urlImage/uriAnexos) no PCM.
alwaysApply: true
---

# Spec — E01-S71 · Imagem e anexos de equipamentos do Auvo

> **Fonte da verdade.** Status: pronto para implementar · Tier: pequeno
> Origem: teste de produção do Lucas (2026-07-14) — "não está trazendo nenhuma das fotos do Auvo,
> por exemplo equipamentos possuem imagens e não estão aparecendo".

## Achado técnico (verificado na API Auvo real, 2026-07-14)
`GET /equipments` retorna `urlImage` (string, URL S3) e `uriAnexos` (array). O descriptor
`registry/equipamentos.ts` (tipo `AuvoEquipment` linhas 14-26, `fromAuvo` 48-60) **não declara nem
captura** esses campos, e a tabela `pcm.equipamentos` (migration `0032`) **não tem coluna de
imagem** (confirmado por query em produção). Qualquer imagem que o Auvo devolve é descartada.

## Resumo
Adiciona `url_imagem`/`uri_anexos` à `pcm.equipamentos`, o descriptor passa a capturar
`urlImage`/`uriAnexos` no `fromAuvo`, e a UI (tela de Equipamentos + cliente-360) exibe a imagem.
Imagens são URLs S3 do Auvo — sem Supabase Storage.

## Critérios de aceite

### AC-1: Schema com imagem
- **Dado** a migration aplicada
- **Quando** `pcm.equipamentos` é consultada
- **Então** tem `url_imagem text` e `uri_anexos jsonb` (RLS/grants inalterados — colunas aditivas)

### AC-2: Sync captura a imagem
- **Dado** um equipamento Auvo com `urlImage`/`uriAnexos`
- **Quando** o pull de equipamentos roda (`pcm-auvo-pull` / cron)
- **Então** `url_imagem`/`uri_anexos` são preenchidos (descriptor `fromAuvo` mapeia; tipo
  `AuvoEquipment` declara os campos)

### AC-3: Imagem exibida
- **Dado** um equipamento com `url_imagem`
- **Quando** a tela de Equipamentos e o painel de equipamentos do cliente-360 renderizam
- **Então** mostram a imagem (thumbnail; abrir maior ao clicar); sem imagem, um placeholder discreto

## Fora de escopo
> Vinculante.
- Upload de imagem de equipamento pelo PCM (o Auvo é dono do dado de equipamento — ADR-0006).
- Storage — imagens são URLs do Auvo.
- Fotos de tarefa/OS — E01-S70.

## Rastreabilidade
- Origem: teste Lucas 2026-07-14; API Auvo confirmou `urlImage`/`uriAnexos` no GET /equipments.
- Arquivos-âncora: migration nova (próximo número livre a partir de `0085`),
  `supabase/functions/_shared/auvo/registry/equipamentos.ts` (tipo + `fromAuvo`),
  `apps/web/src/features/pcm/pages/EquipamentosPage.tsx`,
  `apps/web/src/features/pcm/pages/VisaoClientePage.tsx` (painel de equipamentos).
- Decisão relacionada: ADR-0006 (Auvo é dono do cadastro de equipamento; PCM só lê).
