# ADR-1249 — Mediação da substituição de código de Grupo

**Status:** proposta local, não homologada. Complementa ADR-1246.

Preparar entrada autenticada e gate próprio fechado para o comando privado de substituição de Grupo; a transação verifica a capacidade, papel, Cliente do Grupo, código anterior, motivo e idempotência no núcleo. A interface reutiliza o formulário administrativo existente, preservando a tentativa e o histórico.

Não abrir gate antes de validar autorização/revogação concorrente, travas, ACL/RLS, resposta perdida, colisões, aliases e integração dos escritores e staging. Não altera etiquetas nem Auvo.
