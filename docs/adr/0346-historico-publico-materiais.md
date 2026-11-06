# ADR-0346 — Histórico público de materiais

Status: proposta; gate fechado, sem testes.

O Cliente consulta histórico por Conta, OS e lista, limitado às versões efetivamente publicadas que não estejam retiradas. O conteúdo vem exclusivamente das linhas públicas previamente revisadas; não inclui custos ou campos internos. Retirar uma versão impede consulta do histórico dessa versão, sem apagar os registros de auditoria internos. A paginação é por revisão e o acesso de contato ativo é reavaliado no servidor. Texto livre ainda depende de revisão humana; nenhum filtro automático garante ausência de informação sensível. Requer testes de revogação, isolamento e concorrência antes da ativação.
