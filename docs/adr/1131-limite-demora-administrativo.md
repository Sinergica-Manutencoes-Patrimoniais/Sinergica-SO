# ADR-1131 — Configuração administrativa do limite de demora

Status: proposta local, não aplicada nem homologada.

O limite global de observação de demora é informado explicitamente por administrador ativo, com revisão, motivo e recibo idempotente. Alterar o limite não habilita varredura, não agenda job, não classifica sucesso ou falha e não autoriza reenvio. Sem configuração, a observação automática continua desativada.

A função de configuração tem gate próprio fechado e não concede acesso às tabelas. Antes de ativar, validar autorização atual e claims, revogação concorrente, escopo global, replay, efeitos sobre observações existentes, auditoria, RLS/FORCE e revisão adversarial. Alterar gate de produção permanece fora desta função.
