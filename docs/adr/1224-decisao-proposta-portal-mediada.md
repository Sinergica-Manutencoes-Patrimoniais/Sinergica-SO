# ADR-1224 — Decisão mediada de proposta no Portal

## Decisão

Preparar entrada autenticada para aceite ou recusa de proposta operacional por Cliente e OS. Ela conserva o núcleo privado e sua idempotência, confere ator, vínculo atual, publicação e visibilidade da versão. Para aceite, exige preço público numérico não negativo igual ao preço atual registrado; recusa continua possível com motivo mesmo sem preço.

A mediação não publica nem envia mensagens. Uma tentativa repetida após retirada, transferência ou alteração da versão pode ser recusada e deve permanecer para reconciliação; ausência de sucesso não comprova ausência de decisão anterior.

## Gates

Manter flag e gates fechados até testes de RLS/FORCE, autorização/revogação, publicação, privacidade, preço, replay, concorrência com mudança de versão/retirada, ordem de locks e revisão adversarial. A confirmação na tela não substitui a autorização do servidor.
