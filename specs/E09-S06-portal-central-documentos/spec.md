---
name: spec-E09-S06-portal-central-documentos
description: Contrato — Central de Documentos do portal: download por signed URL dos laudos PMOC/SPDA e do PDF de assessment do condomínio.
alwaysApply: true
tier: pequeno
---

# Spec — Central de Documentos do portal

> **Fonte da verdade.** Status: aprovado. Depende de E09-S01. (Ideia nova aprovada pelo PO.)

## Resumo
O síndico acessa, num só lugar, os **documentos do seu condomínio** — laudos PMOC (E01-S05), laudos
SPDA (E01-S19) e (quando existir) o PDF do assessment — com download por signed URL. Hoje esses
documentos só vão por e-mail.

## Contexto atual (AS-IS)
- Laudo PMOC PDF gerado e no bucket privado `pmoc-laudos` (`pcm.pmoc_records.pdf_url`, E01-S05),
  hoje distribuído por e-mail. Laudos SPDA em `LaudosSpdaPage`/`inspecoes-laudos.ts`. Padrão de acesso
  a bucket privado é signed URL 1h.

## Critérios de aceite

### AC-1: Listar documentos do próprio condomínio
- **Dado** um síndico logado
- **Quando** abre a Central de Documentos
- **Então** vê a lista dos documentos do **seu** condomínio (tipo, data, título), escopada por
  `cliente_id`, ordenada do mais recente.

### AC-2: Download por signed URL
- **Dado** um documento listado
- **Quando** o síndico clica em baixar
- **Então** recebe uma signed URL temporária (padrão do projeto) para o arquivo no bucket privado; o
  bucket nunca é público.

### AC-3: Tipos suportados
- **Dado** os documentos existentes
- **Quando** a central lista
- **Então** cobre laudo PMOC (E01-S05) e laudo SPDA (E01-S19); o PDF de assessment entra quando/se a
  geração existir (degrada ausente sem erro).

### AC-4: Sem documento
- **Dado** condomínio sem documentos
- **Quando** a central abre
- **Então** estado vazio claro.

## Fora de escopo (vinculante)
- Gerar os PDFs (é das stories de origem — E01-S05 etc.).
- Assinatura digital de documentos (evolução futura).

## Rastreabilidade
- `apps/web/src/features/area-cliente/` (Central de Documentos)
- Fontes: `pmoc-laudos` / `pcm.pmoc_records` (E01-S05), laudos SPDA (E01-S19)
- Signed URL: padrão `createSignedUrl` (`supabase-qualidade-adapter.ts` `urlAssinadaMidia`)
- RLS por `cliente_id` nas tabelas de documento
