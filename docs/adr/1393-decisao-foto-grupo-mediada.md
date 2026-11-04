# ADR-1393 — Decisão sobre foto de Grupo mediada

Leitura e decisão PCM passam por entradas autenticadas, separadas por gates desligados, com `execucao.validar`, autorização coordenada e núcleos privados. Registro mantém identidade de pedido e revisão. Decisão não comprova conteúdo, autoria ou execução, não encerra OS e não envia Auvo.

Antes de habilitar: aplicação coordenada, testes de Storage real, ACL/RLS/FORCE, sessão, concorrência, supressão, replay, revogação e revisão adversarial.
