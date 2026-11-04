# ADR-0658 — Aprovação parcial por linha

Status: proposta; gate fechado, não homologada.

PCM aprova explicitamente até 50 linhas conferidas no ciclo corrente, com retratos de atributos e revisão dos candidatos de código. O registro é imutável, revisionado, autorizado, auditado e idempotente; não escreve na estrutura oficial. Referências devem estar incorporadas/atualizadas ou incluídas na aprovação, sem pai rejeitado. Os comandos canônicos continuam exigindo pai efetivamente incorporado antes de criar o filho, e validam Cliente e duplicidade novamente.

A guarda de incorporação aceita aprovação integral vigente ou aprovação parcial da própria linha no ciclo e retrato atuais. Reabertura invalida aprovação anterior sem apagar histórico. A integração parcial de campos estruturados de localização/Sistema/Componente fica bloqueada até os respectivos comandos e snapshots serem adaptados; códigos não são reservados por esta etapa e continuam sujeitos à validação no ato da incorporação. Esta limitação impede afirmar AC-4 completo. Não altera namespace de Grupo ou integra Auvo. Gate/RPC fechados; UI, testes de corrida/retry/isolamento e revisão adversarial pendentes.
