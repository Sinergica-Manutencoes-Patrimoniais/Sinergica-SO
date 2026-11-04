# ADR-0332 — Decisão humana de documento

Prepara-se histórico imutável e versionado de decisões `aceito` ou `rejeitado` por documento, com motivo, autorização, revisão e request id idempotente. A decisão não altera a linha ou o lote, não publica nem incorpora documento. Aceite não comprova autenticidade, segurança ou ausência de dados pessoais.

Gate e execução nascem fechados; interface, testes de concorrência e segurança e revisão adversarial antecedem ativação.
