# Commands and queries — E01-S184

## Contratos

`ConsultarPropostaPublica(id, versao?)` e `ExportarPropostaPublica(id, versao)` autorizam Conta ativa e devolvem DTO allowlist. Consulta interna de custos exige permissão específica; temporariamente manter restrita a papel administrativo existente até E01-S170 fornecer capacidade granular, sem dependência circular. Rotas antigas devem negar ou usar a mesma projeção. Erros uniformes: nao_encontrado_ou_sem_acesso; arquivo_privado. Snapshot público não admite fallback de preco_venda para custo_unitario. request_id em remediação impede processar arquivo duas vezes.

## Envelope e autorização

Nomes snake_case abaixo representam campos de persistência; na borda de comando aplicar o envelope camelCase global `requestId`/`expectedRevision`, com adaptação explícita, sem dois protocolos concorrentes.

DTO compartilhado em `packages/shared/src/protecao-custos-portal-contracts.ts`; validar tipos e presença na borda. request_id UUID obrigatório nas escritas e expected_revision obrigatório em alteração de objeto existente. Cliente/autor derivam da sessão e vínculos oficiais; ler Conta e ação no servidor. Retentativa idêntica retorna resposta anterior; request_id com conteúdo diferente é conflito. Permissão negada usa 403 sem dados internos; objeto fora de escopo não permite enumerar outra Conta.

## Eventos e consultas

Evento append-only inclui tipo, objeto, origem, autor, data, request_id, revisão e motivo quando aplicável; nunca custos em canal público. Consultas paginadas com filtro Cliente/status/período e cancelamento; envelopes não expõem tabelas privadas. Ver contrato global `docs/planejamento/plano-manutencao/contratos-programa.md`.

## Cenários verificáveis

- US1: AC-1, AC-2 — Semear custo sentinela no snapshot, consultar como Cliente e inspecionar JSON bruto.
- US2: AC-3, AC-4 — Baixar versão antiga/nova e comparar privado intacto com público sanitizado.
- US3: AC-5, AC-6 — Comparar usuário interno com e sem ver custos; verificar link de anexo.

