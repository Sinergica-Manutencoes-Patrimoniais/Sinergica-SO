---
name: "docs-adr-1215-atribuicao-tecnico-despesa-mediada-md"
description: "Documento Sinérgica SO: ADR-1215 — Atribuição mediada de técnico à despesa"
alwaysApply: false
---

# ADR-1215 — Atribuição mediada de técnico à despesa

## Decisão

Preparar entradas autenticadas para listar equipe da Visita, consultar atribuição e registrar alteração de responsável de despesa. Cada entrada exige ator atual, Cliente, capacidade `despesa_visita.gerir` e gate de resumo; leituras e escrita mantêm os núcleos privados. A escrita confere vínculo atual da despesa com Cliente e Visita, preserva requestId, revisão e histórico existentes e não modifica rateio, pagamento ou cobrança.

Uma atribuição declarada não prova execução. Repetição após transferência ou remoção do vínculo pode ser recusada; resultado incerto exige reconciliação e não autoriza novo request automaticamente.

## Gates

Interface e gate permanecem fechados até validar locks e ordem global, RLS/FORCE, permissões, transferência, revisão, reentrega, concorrência, seleção da equipe e revisão adversarial. A serialização depende de todos os escritores reais e não está comprovada por este desenho.
