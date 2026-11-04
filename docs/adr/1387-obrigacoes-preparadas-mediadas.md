# ADR-1387 — Leitura mediada de obrigações preparadas

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Adicionar entrada de leitura com gate próprio desligado, capacidade de gestão, trava de autorização e gate do núcleo de obrigações. Preservar contrato, paginação e exclusão de Visitas suprimidas; núcleo permanece privado. A tela confere sessão e ordenação entre páginas e não apresenta ações de Grupo durante reconsulta ou divergência.

## Limites

É fonte parcial e não comprova execução, fila executável ou ausência de efeitos externos. Antes de ativar validar Cliente, paginação concorrente, revogação, supressão, histórico, ACL/RLS/FORCE e revisão adversarial.
