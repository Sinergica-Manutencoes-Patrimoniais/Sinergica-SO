# ADR-1205 — Leitura mediada das reservas Equipment

## Decisão

Preparar entrada autenticada para a consulta privada de reservas S177, preservando o contrato e todos os gates e checagens da função existente. A nova entrada exige sessão igual ao ator declarado e capacidade `cadastro.gerir` no Cliente; não concede execução direta ao núcleo, nem revela política ou credencial externa. Página limita 100 registros e mantém ordem e escopo do núcleo.

Esta consulta não prova sucesso, ausência ou unicidade de efeito no Auvo, não libera reservas e não autoriza retry. A interface usa a entrada somente com flag específica, desligada por padrão.

## Gates

Não ativar antes de testar autenticação real, isolamento, revogação, paginação concorrente, políticas/RLS, fechamento de gates e revisão adversarial. O protocolo de reconciliação de envios incertos continua pendente.
