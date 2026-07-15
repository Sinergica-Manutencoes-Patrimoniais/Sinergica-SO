---
name: spec
description: Contrato — inspeções profissionais ABNT NBR 16747: cabeçalho + itens ricos, edição completa, tipos/checklists parametrizáveis, mídia por item via Storage.
alwaysApply: true
---

# Spec — E01-S73 · Inspeções profissionais ABNT NBR 16747

> **Fonte da verdade.** Status: pronto para implementar · Tier: **arquitetural**
> (`product.md` + `design.md` desta pasta são leitura obrigatória). Origem: teste de produção do
> Lucas (2026-07-14) — inspeção cria mas não edita, faltam campos, quer modelo profissional de
> engenharia parametrizável.

## Resumo
Reconstrói a inspeção (E01-S19) no modelo ABNT NBR 16747: cabeçalho rico (Dados da Inspeção) + itens
ricos (Itens de Inspeção), edição completa em todas as camadas, tipos de inspeção e checklists
configuráveis por UI, e mídia (foto/vídeo/documento) por item via Supabase Storage privado.

## Critérios de aceite

### AC-1: Editar inspeção e item
- **Dado** um usuário com `pcm='escrita'` e uma inspeção existente
- **Quando** edita o cabeçalho ou um item
- **Então** salva (novos casos de uso `editarInspecao`/`editarItem` + `.update()` no adapter — hoje
  inexistentes); a RLS de update já permite. Excluir item também disponível

### AC-2: Cabeçalho rico (Dados da Inspeção)
- **Dado** o formulário de inspeção
- **Quando** aberto
- **Então** expõe: código, tipo de inspeção, cliente, edificação/local, endereço, data, hora
  início/fim, inspetor, responsável no local, status, escopo, norma técnica, ART, condições da
  inspeção, observações gerais, anexos

### AC-3: Itens ricos (Itens de Inspeção)
- **Dado** um item de inspeção
- **Quando** criado/editado
- **Então** permite: categoria, sistema, elemento inspecionado, localização, identificação,
  resultado (Conforme / Não Conforme / Não Aplicável), grau de risco, estado de conservação,
  descrição da anomalia, medições, fotos, vídeos, documentos, recomendação, prazo para correção,
  responsável pela ação corretiva, observações — nada hardcoded (hoje resultado/severidade/foto são
  hardcoded em `InspecoesPage.tsx:175-179`)

### AC-4: Tipos e checklists parametrizáveis
- **Dado** um supervisor/superadmin
- **Quando** acessa a admin de templates
- **Então** cria/edita tipos de inspeção (predial/elétrica/SPDA/hidráulica…) e seus checklists
  (itens esperados) sem depender de dev; ao criar uma inspeção de um tipo, os itens do template já
  vêm pré-carregados para preencher

### AC-5: Mídia por item (Storage)
- **Dado** um item de inspeção
- **Quando** o inspetor anexa foto/vídeo/documento
- **Então** o arquivo sobe para o bucket privado `inspecoes-midia` (signed URL) com RLS por módulo
  PCM; aparece no item; é removível. Mídia vinda do Auvo (import) continua como URL, sem Storage

### AC-6: Migração sem perda
- **Dado** inspeções/itens existentes da E01-S19
- **Quando** a migration aditiva aplica
- **Então** os dados continuam válidos (campos novos nulos no histórico); nada é dropado/perdido

## Fora de escopo
> Vinculante.
- Geração do PDF do laudo (modelo prepara; geração é story futura).
- Assinatura digital.
- Reconstruir laudo SPDA (`pcm.laudos_spda`) — coexiste, não muda.

## Rastreabilidade
- Origem: teste Lucas 2026-07-14; referência ABNT NBR 16747 (Inspeção Predial). Decisões do PO em
  `product.md`; schema/Storage em `design.md`.
- Arquivos-âncora: migration nova (a partir de `0085`), `pcm.inspecoes`/`pcm.inspecao_itens` +
  `tipos_inspecao`/`checklist_templates`/`checklist_template_itens`; bucket Storage `inspecoes-midia`;
  `apps/web/src/features/pcm/domain/inspecoes-laudos.ts`,
  `application/qualidade-gateway.ts` + `qualidade.ts` (add editar/excluir/templates),
  `infrastructure/supabase-qualidade-adapter.ts` (add update/delete + Storage),
  `pages/InspecoesPage.tsx` (reconstruir em 2 partes) + nova página de admin de templates.
- ADR: primeiro uso de Supabase Storage no projeto — registrar decisão durável.
