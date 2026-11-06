# ADR-0436 — Guarda opt-in de geração por estado do Plano

Status: preparado, gate desligado, não aplicado nem homologado. Os comandos preparados de calendário 0337 e Visita 0455 já bloqueiam Plano fora de aprovado/ativo e bloqueiam o Plano durante a operação. Esta defesa adicional aplica a mesma condição a inserções diretas nas duas tabelas preparadas, com lock compartilhado do Plano para serializar suspensão/encerramento.

Não modifica ocorrências existentes, OS nem geradores legados; não prova que estes respeitem suspensão. O trigger está desligado por padrão e não cobre outras origens. Concorrência, ordem de locks, efeitos e recuperação exigem testes e revisão adversarial antes da ativação.
