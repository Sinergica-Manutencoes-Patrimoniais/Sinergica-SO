# ADR-0826 — Trava conservadora da leitura histórica legada

Status: preparado, não homologado.

A função histórica legada pode resolver comprovante mediado sem conferir digest. Ela permanece revogada aos papéis de aplicação, mas uma futura concessão poderia reabrir o bypass. A migration mantém a autorização existente e nega referências cujo caminho ou objeto estejam vinculados a qualquer reserva mediada. Comprovantes históricos sem reserva preservam o comportamento anterior. Esta trava não fornece ainda leitura histórica mediada, nem revoga URLs já emitidas; não altera políticas ou gates e exige revisão/rollout coordenado.
