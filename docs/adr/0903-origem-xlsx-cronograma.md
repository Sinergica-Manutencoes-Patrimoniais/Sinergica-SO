---
name: "docs-adr-0903-origem-xlsx-cronograma-md"
description: "Documento Sinérgica SO: ADR-0903 — Custódia transacional da origem XLSX"
alwaysApply: false
---

# ADR-0903 — Custódia transacional da origem XLSX

Data: 2026-10-30 · Status: preparação, gate fechado; não homologado.

## Decisão

Na recepção XLSX, guardar os bytes originais em registro privado associado ao lote canônico `pcm.sso_levantamentos`, sem recriar lote de cronograma. Um comando mediado específico exige gates de origem XLSX e cronograma, autorização atual `plano.gerir` e executa a recepção canônica e a custódia numa mesma transação. A fonte é limitada a 5 MiB e o SHA-256 é calculado pelo banco, comparado ao declarado e registrado com ator e data. O hash não demonstra que a matriz corresponde ao arquivo; conferência e aprovação permanecem obrigatórias. A auditoria registra IDs e tamanho, nunca os bytes.

Lote existente sem origem não recebe arquivo retroativamente pela recepção: exige fluxo de reconciliação próprio. Repetição só retorna sucesso quando lote, matriz, ator e bytes coincidem. Divergência ou falha na gravação reverte tudo. A tabela tem FORCE RLS, sem acesso direto de usuários ou serviço; não há download ou exclusão nesta etapa. Limites de request do Supabase, custo de banco, backup, retenção, concorrência e isolamento exigem medição e revisão antes de ativar. Não há rollout ou chamada Auvo.

## Compatibilidade

Rotas CSV anteriores não são alteradas. O gate novo vem fechado; rollback operacional é mantê-lo fechado e preservar os registros. Não converter, apagar ou migrar automaticamente origens anteriores. A abertura exige verificação de rollout compatível, revisão adversarial e testes integrados, incluindo falhas e concorrência.
