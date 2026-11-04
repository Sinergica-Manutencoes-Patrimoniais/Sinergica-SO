# ADR-1115 — Revisão de correlação declarada de gasto

Status: proposta local, não aplicada nem homologada.

## Decisão

Permitir revogar ou reativar uma correlação declarada mediante revisão esperada, motivo, capacidade e requestId. As decisões são imutáveis e sequenciais; a última define se a correlação impede seleção conjunta em nova composição. A composição e a decisão compartilham a trava da fonte e a revogação não altera composições já registradas, valores ou cobranças.

## Limites

Correlação é declaração humana, não prova física. Ao descobrir correlação depois de um orçamento salvo, o orçamento continua exigindo revisão própria. Testar sincronização com composição/retificação, validade após mudança de Cliente, permissões, histórico, replay, RLS/FORCE, propagação por fontes ancestrais e revisão adversarial antes da ativação.
