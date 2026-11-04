# ADR-1107 — Retificação de fonte de aquisição não utilizada

Status: proposta local, não aplicada nem homologada.

## Decisão

Uma fonte declarada ainda não utilizada pode ser substituída por nova fonte ligada à mesma lista e OS, mantendo a anterior imutável e registrando motivo, ator, requestId e vínculo de substituição. A fonte substituída não fica disponível para novas composições. Se a fonte já estiver vinculada a proposta, a retificação é recusada: revisão de orçamento e liberação de uso exigem fluxo próprio, não uma alteração silenciosa. Os comandos usam trava comum por fonte.

## Limites

Não resolve duplicidade de gastos físicos, correção após uso ou histórico de caminhos antigos. Testar ordem de locks entre composição e retificação, replay, concorrência, Cliente, RLS/FORCE, permissões e revisão adversarial antes de habilitar. Não cria cobrança ou tarefa externa.
