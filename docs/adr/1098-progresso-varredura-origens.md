# ADR-1098 — Progresso da varredura de origens internas

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar progresso transacional por execução, com cursor composto de tipo e objeto, revisão e recibos imutáveis. Uma página chama a varredura local na mesma transação; repetição idêntica devolve o mesmo recibo. A função de avanço é restrita ao serviço e depende dos gates fechados. Não há cron, chamada externa ou alteração dos objetos de origem.

## Limites

O cursor não cria snapshot e novos objetos antes dele só serão vistos em nova execução. Não cobre ausências de origem, transferências ou reconciliação remota. Exigem validação: ordenação/collation do cursor, concorrência, replay, RLS/FORCE, volume, contexto de serviço e revisão adversarial. Nenhum agendamento é autorizado pela existência do código.
