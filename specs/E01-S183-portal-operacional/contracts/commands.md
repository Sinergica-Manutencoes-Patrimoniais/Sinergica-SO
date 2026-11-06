# Commands and queries — E01-S183

## Contratos

`ListarContextoOperacional(cliente_id)` devolve apenas Conta do contato ativo, listas/OS/responsabilidade/estados e totais públicos; `InformarDisponibilidade(request_id, lista_id, estado, observacao?)`; `DecidirOrcamento(request_id, proposta_id, versao, decisao, motivo?)`; `ObterAnexoPublico(anexo_id)` retorna link curto só após autorização. Mesmo controle em consultas diretas; negar IDs alheios com resposta uniforme. Repetição de mesma decisão retorna original; concorrente conflitante retorna decisao_ja_registrada. Nunca aceitar cliente_id do corpo como prova de acesso.

## Envelope e autorização

Nomes snake_case abaixo representam campos de persistência; na borda de comando aplicar o envelope camelCase global `requestId`/`expectedRevision`, com adaptação explícita, sem dois protocolos concorrentes.

DTO compartilhado em `packages/shared/src/portal-operacional-contracts.ts`; validar tipos e presença na borda. request_id UUID obrigatório nas escritas e expected_revision obrigatório em alteração de objeto existente. Cliente/autor derivam da sessão e vínculos oficiais; ler Conta e ação no servidor. Retentativa idêntica retorna resposta anterior; request_id com conteúdo diferente é conflito. Permissão negada usa 403 sem dados internos; objeto fora de escopo não permite enumerar outra Conta.

## Eventos e consultas

Evento append-only inclui tipo, objeto, origem, autor, data, request_id, revisão e motivo quando aplicável; nunca custos em canal público. Consultas paginadas com filtro Cliente/status/período e cancelamento; envelopes não expõem tabelas privadas. Ver contrato global `docs/planejamento/plano-manutencao/contratos-programa.md`.

## Cenários verificáveis

- US1: AC-1, AC-2 — Cliente A informa disponibilidade; PCM vê aviso; Cliente B é recusado.
- US2: AC-3, AC-4 — Aprovar versão vigente, recusar antiga e consultar documento financeiro público.
- US3: AC-5, AC-6 — Tentar objetos de B pela sessão de A e repetir depois de revogar contato.

