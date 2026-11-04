# ADR 0875 — Mediação da edição de linhas de materiais

## Contexto

A edição versionada de 0325 mantém texto original, revisão, evidências, idempotência e auditoria, mas sua função está diretamente acessível sem serialização com revogação de autorização.

## Decisão

Adicionar entrada mediada com gate próprio inicialmente fechado, sessão autenticada, READ COMMITTED, trava compartilhada de autorização e releitura do gate. Delegar ao núcleo existente a verificação da lista, OS, Cliente, revisão e evidências. Revogar a execução direta do núcleo e trocar o adapter sem fallback, preservando transação e contrato.

## Limites e implantação

Clientes antigos ainda podem chamar o núcleo: requer inventário, rollout coordenado, prova de concorrência e revisão adversarial antes de implantação. Fechar o gate para reversão; restaurar ACL antiga somente após análise de segurança. Não alterar histórico, texto original, leitura ou outras operações. Sem Auvo.
