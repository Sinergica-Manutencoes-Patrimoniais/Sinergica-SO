# ADR-0886 — Leitura individual de esforço serializada

Data: 2026-10-30 · Status: proposta para implementação, gate fechado.

Consulta individual de esforço também retornou dados durante revogação em andamento no banco sintético. Criar entrada volátil única para OS, ocorrência de calendário e ocorrência de Visita; exigir READ COMMITTED e trava compartilhada da autorização e do gate, e delegar a validação de Cliente/origem aos núcleos estáveis existentes. Revogar execução autenticada dos núcleos e atualizar o adapter em rollout coordenado.

Travas dependem dos escritores de autorização; testar as duas ordens, gates, tipos e isolamento de Clientes. Não comprova ACL/HTTP oficiais nem saldo operacional. Não abrir gates, homologar ou enviar Auvo sem revisão e evidências posteriores.
