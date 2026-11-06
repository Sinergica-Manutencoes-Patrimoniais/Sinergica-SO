---
name: "docs-adr-0904-consulta-origem-xlsx-cronograma-md"
description: "Documento Sinérgica SO: ADR-0904 — Consulta mediada da origem XLSX"
alwaysApply: false
---

# ADR-0904 — Consulta mediada da origem XLSX

Data: 2026-10-30 · Status: preparação, gates fechados; não homologado.

## Decisão

Complementa a ADR-0903: preparar consulta dos bytes originais por comando mediado, sem ativação automática. A consulta exige os gates de recepção, mediação, custódia e leitura abertos, autorização atual `plano.gerir` para o Cliente e vínculo do lote canônico à origem. O hash é recalculado antes da resposta. Cada acesso bem-sucedido é auditado com ator, lote, Cliente e tamanho, sem registrar conteúdo nem hash. Inexistência e lote de outro Cliente têm a mesma resposta de acesso negado. Falha de auditoria impede entrega.

## Compatibilidade e implantação

Migração aditiva, sem alteração de dados existentes; acesso direto permanece proibido. Leitura possui gate próprio fechado. Fechar qualquer gate bloqueia novas consultas sem apagar origens. Não há interface, rollout ou envio ao Auvo nesta etapa. Antes de habilitar: testes no Supabase real, permissões e concorrência, limites de resposta e memória, segurança do download e revisão adversarial. SHA-256 confirma integridade da origem armazenada, não a correspondência entre matriz e arquivo; essa conferência permanece pendente.
