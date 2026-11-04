# ADR-1063 — Roteiro coordenado para políticas de upload

**Status:** implementação candidata, não homologada e não autorizada para execução. Complementa ADR-0800 e ADR-0837.

Preparar roteiro transacional manual para substituir as doze políticas de seis buckets por um dispatcher comum, instalar guarda restritiva global e manter autorização específica de cada bucket. As ACLs dos helpers existentes não são ampliadas. A despesa mantém seu gate fechado; os demais buckets permanecem sujeitos à guarda conservadora. O roteiro registra fotografia das definições anteriores e instaladas; a reversão separada recusa alterações posteriores nas políticas fotografadas e restaura as expressões capturadas.

Os roteiros não integram migrations automáticas nem foram executados. Exigem marcador explícito na sessão, privilégios administrativos e bloqueio exclusivo de `storage.objects`, que pode interromper uploads durante a transação. Não usar o marcador como substituto de aprovação. Testar previamente em cópia isolada a matriz completa de buckets/roles, ACLs, gates, concorrência, impacto em todos os uploads legados, rollback e Storage real; realizar revisão adversarial e obter autorização de DevOps antes de qualquer execução. Não pressupor que erros e negações anteriores sejam semanticamente equivalentes em todos os planos SQL.
