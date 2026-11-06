# ADR-1217 — Recibo de atribuição de técnico à despesa

## Decisão

Preparar consulta autenticada do recibo existente por requestId e conteúdo completo da atribuição. Exige mesmo ator, Cliente e Visita atuais, capacidade de gestão de despesa e gate existente. Não repete a alteração, não cria novo comando e não confirma execução ou pagamento.

Ausência, divergência e objeto inacessível são indistinguíveis; uma consulta sem recibo não prova falha de pedido ainda em andamento. A tentativa deve permanecer guardada. Transferência ou remoção do vínculo pode impedir recuperação e exigir suporte.

## Gates

Manter flag e gate fechados até validar autorização, RLS/FORCE, replay, conteúdo, concorrência com commit, transferência, privacidade e revisão adversarial.
