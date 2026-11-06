# ADR-0048 — Aprovação transacional com snapshot

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

O comando de aprovação exige concessão individual atual `plano.gerir`, Plano em revisão, revisão esperada, vigência inicial e ao menos uma Rotina. O próprio criador autorizado pode aprovar. Revalida no servidor cada Rotina, incluindo alvo ativo no Cliente, recorrência, data-base de calendário, instrução ou questionário e questionário ativo. Tempo ausente ou sem referência permanece alerta de capacidade incompleta, sem inferir proibição operacional não definida. Resultado de prévia não autoriza a aprovação.

Na mesma transação, o comando bloqueia Plano e referências consultadas, congela cópia identificada do Plano, Rotinas, nomes de alvo e conteúdo de questionários recebidos, atualiza estado e vigência, e grava autor/data, auditoria e resultado idempotente. Não gera Ocorrência, OS ou tarefa Auvo. A referência de versão do questionário contém ID, ID Auvo e `updated_at` observado; não presumir versão externa que não existe no catálogo. Conteúdo congelado não muda quando fonte muda. Consumidores históricos, versões posteriores, concorrência em duas sessões e revisão adversarial são gates pendentes antes de PASS.
