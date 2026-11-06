# ADR-1093 — Início observado do processamento da outbox

Status: proposta local, não aplicada nem homologada.

## Contexto

A outbox tem estado `processing`, mas não registra quando a reivindicação ocorreu. `enqueued_at` mede idade do enfileiramento, não duração do processamento; não é válido chamá-la de lease vencido.

## Decisão

Adicionar timestamp de início preenchido pelo banco na transição para `processing`, sem backfill inventado para linhas já processando. Mantê-lo estável durante essa tentativa e limpá-lo quando sair desse estado. Registros anteriores sem timestamp permanecem com início desconhecido. Não alterar o worker, repetir envio ou assumir que um efeito remoto não ocorreu.

## Limites

O timestamp não prova que o worker morreu e não é um lease com prazo, dono ou renovação. A migração e seus efeitos em escritores, triggers, transações concorrentes, timezone e dados legados requerem testes e revisão adversarial antes de implantação. Qualquer suspeita deve resultar em estado incerto e conferência, nunca retry automático.
