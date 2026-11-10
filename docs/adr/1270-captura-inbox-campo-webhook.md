---
name: "docs-adr-1270-captura-inbox-campo-webhook-md"
description: "Documento Sinérgica SO: ADR-1270 — Captura de evento de campo antes da triagem legada"
alwaysApply: false
---

# ADR-1270 — Captura de evento de campo antes da triagem legada

Status: proposta local; não aplicada nem homologada.

Quando explicitamente habilitada, a entrada de webhook autenticado deve registrar o evento de tarefa na inbox existente antes de decisões de status ou resolução de Cliente. A chave usa hash de uma serialização determinística do payload recebido; não é revisão nem ordem de eventos do fornecedor. Reentrega do mesmo payload usa a mesma chave; payloads diferentes podem gerar envelopes diferentes para a mesma tarefa, sem garantir deduplicação da OS.

A captura utiliza a função transacional existente com acesso exclusivo ao papel de serviço e seu gate fechado. Não registrar como evento confiável algo que falhou autenticação. O processamento legado continua existindo: esta etapa não o substitui, não aplica o envelope e não comprova criação atômica de Chamado/OS. Em falha ou timeout, não declarar captura bem-sucedida; reentrega precisa usar o mesmo payload.

Antes de habilitar: provar assinatura, limites e privacidade do payload, retenção, equivalência de serialização, concorrência, autorização do serviço, integração com polling e com processamento transacional único, comportamento do webhook legado, RLS/FORCE e revisão adversarial. Não ativar nem enviar tarefas reais nesta etapa.
