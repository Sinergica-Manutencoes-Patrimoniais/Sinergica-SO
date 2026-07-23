---
name: spec-E09-S05-portal-os-notas-anexos
description: Contrato — no Portal do Cliente, acompanhar OS e interagir com notas + anexos (nova superfície de escrita do cliente numa OS), visíveis ao time interno.
alwaysApply: true
tier: pequeno
---

# Spec — OS no portal: acompanhar + notas/anexos do cliente

> **Fonte da verdade.** Status: aprovado. Depende de E09-S01.
> **Superfície NOVA:** hoje não existe escrita do cliente em OS (relato/anexos atuais são read-only do
> Auvo). Esta story cria a tabela de notas + bucket.

## Resumo
O síndico acompanha as OS do seu condomínio (read-only do dado operacional) e pode **adicionar notas
de texto e anexos** a uma OS. As notas do cliente ficam registradas (append-only), visíveis ao time
interno da Sinérgica.

## Contexto atual (AS-IS)
- OS: `pcm.ordens_servico`; timeline `pcm.os_status_eventos`; snapshot Auvo `pcm.auvo_task_snapshots`
  (`relato_usuario`/`anexos`) — **tudo read-only, escrito por `service_role`**. Não há tabela de
  notas/comentários de OS nem bucket de anexos de OS (E01-S15:4-5 decidiu não copiar mídia do Auvo).

## Critérios de aceite

### AC-1: Acompanhar OS do próprio condomínio
- **Dado** um síndico logado
- **Quando** abre a seção OS
- **Então** vê as OS do **seu** condomínio (RLS `cliente_id`) com status/andamento operacional,
  read-only; nunca de outro cliente.

### AC-2: Adicionar nota do cliente numa OS
- **Dado** uma OS do síndico
- **Quando** ele escreve uma nota
- **Então** a nota é gravada numa tabela append-only (`autor=cliente`, timestamp), vinculada à OS e ao
  `cliente_id`, visível ao time interno.

### AC-3: Anexar arquivo do cliente numa OS
- **Dado** uma OS do síndico
- **Quando** ele anexa um arquivo (foto/doc)
- **Então** o arquivo sobe a um **bucket privado novo de anexos de OS**, referência gravada na nota;
  acesso por signed URL. Valida tipo/tamanho.

### AC-4: Isolamento e imutabilidade
- **Dado** notas/anexos de várias OS/clientes
- **Quando** o síndico consulta
- **Então** só vê os da sua OS/condomínio; notas são append-only (não edita/apaga nota já postada).

## Casos de borda e erros
- Nota vazia → não grava.
- Anexo inválido → rejeita antes do upload.
- OS de outro cliente por ID → RLS nega.
- (Decisão a registrar) nota do cliente propaga ao Auvo? Default: **fica no PCM**, não vai ao Auvo —
  confirmar no design da task e cobrir.

## Fora de escopo (vinculante)
- Editar campos operacionais da OS (status/técnico/data) — só o time interno/Auvo.
- Espelhar a nota no Auvo (fica PCM-side salvo decisão contrária).

## Rastreabilidade
- `apps/web/src/features/area-cliente/` (seção OS)
- Migration: `pcm.os_notas` (append-only, RLS por `cliente_id`) + bucket privado `os-anexos`
- Reusa leitura de OS (`pcm.ordens_servico`) e padrão de Storage/signed URL do projeto
