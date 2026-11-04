# ADR-1210 — Consulta de recibo de continuidade de parcela

## Decisão

Preparar consulta autenticada do recibo imutável da criação de OS de continuidade por requestId e fotografia completa, sem executar novamente o comando. Exige mesmo ator, capacidades atuais, Chamado e OS ainda pertencentes ao Cliente e igualdade do payload original. Ausência, divergência e objeto inacessível são indistinguíveis.

A consulta não cria OS, não altera reserva ou tarefa Auvo e não prova execução. A repetição do comando continua separada e usa seu contrato idempotente. Em caso de transferência ou exclusão lógica, o recibo pode permanecer indisponível e deve ser tratado por reconciliação autorizada.

## Gates

Gate de continuidade e flag da tela permanecem fechados. Antes de ativar: validar autenticação, RLS/FORCE, payload temporal, revogação, concorrência, transferência, privacidade e revisão adversarial.
