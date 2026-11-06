---
name: "docs-adr-0635-revisao-origens-reconciliacao-md"
description: "Documento Sinérgica SO: ADR-0635 — Revisão de origens na reconciliação"
alwaysApply: false
---

# ADR-0635 — Revisão de origens na reconciliação

Com gate fechado não há mudança no comando legado. Quando habilitado, registra-se ao lado de cada nova decisão a revisão e o estado da declaração de material e a identidade imutável da declaração de serviço. A ordem é request, par, linha de material; o bloqueio da linha serializa alterações normais de material. Retry de decisão anterior sem metadado não inventa uma revisão histórica.

Essa informação não prova identidade física nem torna uma decisão válida para faturar. Decisões anteriores não possuem revisão capturada; 0857 continua conservador. Não há lock de proposta neste wrapper: 0857 bloqueia inserções da tabela de decisões com lock amplo antes de adquirir lock de proposta, portanto introduzir ordem inversa criaria risco de deadlock. Antes de ativar, revisar todos os escritores, privilégios, efeito dos locks e transações em curso; testar concorrência e migrations. Não cria candidato ou cobrança.
