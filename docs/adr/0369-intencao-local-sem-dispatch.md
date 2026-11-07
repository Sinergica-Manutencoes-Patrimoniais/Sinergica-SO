---
name: "docs-adr-0369-intencao-local-sem-dispatch-md"
description: "Documento Sinérgica SO: ADR-0369 — Registro local bloqueado de intenção de envio"
alwaysApply: false
---

# ADR-0369 — Registro local bloqueado de intenção de envio

Status: proposta; sem testes ou ativação.

O PCM registra uma intenção local auditada por OS e revisão confirmada da Visita, depois de bloquear escopos de política e revalidar confirmação PCM, política efetiva, confirmação explícita obrigatória e vínculo de OS. Calcula T−24 em UTC, mas não publica na outbox, não cria tarefa e nunca autoriza rede. O registro é armazenado no livro de comandos já existente, não é uma fila consumível; execução futura deve adaptar a outbox canônica, validar novamente condições e definir integração transacional na confirmação PCM. O worker atual da outbox pode efetuar envio real, portanto inserção nele sem gate comprovado seria insegura. Origens de confirmação externa ainda não possuem contrato explícito e não são inferidas. Exige revisão de lock, cancelamento, idempotência e testes antes da ativação.
