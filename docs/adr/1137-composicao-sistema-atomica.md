---
name: "docs-adr-1137-composicao-sistema-atomica-md"
description: "Documento Sinérgica SO: ADR-1137 — Composição atômica de Sistema"
alwaysApply: false
---

# ADR-1137 — Composição atômica de Sistema

Status: proposta local, gates fechados; não aplicada nem homologada.

Preparar comando único para alterar a composição de um Sistema, recebendo Cliente, ator, requestId, membros observados e membros desejados. O servidor confirma a composição anterior sob trava, verifica capacidade e escopo das pontas, aplica inclusões e remoções em uma transação e grava recibo e auditoria. Repetição idêntica devolve o recibo; conteúdo divergente ou fotografia antiga não é reaplicado. Vínculos preservados mantêm sua identidade.

A operação depende da guarda de vínculo da ADR-1136 e de seu gate ativo para serializar escritores antigos pelo Sistema; serviço interno deve passar pela mesma guarda. Não habilitar antes de inventariar todos os escritores e gatilhos, concorrência com transferência, revogação, preservação de dados, RLS/FORCE, recuperação de pedido incerto e revisão adversarial. O comando não cria Componentes nem tarefas Auvo.
