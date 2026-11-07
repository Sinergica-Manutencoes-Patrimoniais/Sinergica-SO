# Commands and queries — E01-S181

## Contratos

`PrepararOrcamentoOperacional(request_id, cliente_id, os_id, lista_id, composicao_interna, fator, custos_operacionais, preco_venda, expected_revision)`; `EnviarVersao(request_id, proposta_id, expected_revision)`; `DecidirVersao(request_id, proposta_id, versao, decisao, motivo?)`; `DispensarOrcamento(request_id, os_id, lista_id, motivo?, regra_contratual_id?)`. Edição aprovada gera versão/complemento. Erros: custo_sem_permissao, preco_abaixo_piso, versao_obsoleta, expirado, cliente_divergente, decisao_conflitante. Resposta pública nunca inclui campos privados. Legado resolve correspondência e somente cria OS para requisição pré-OS ainda sem OS; concorrência trava origem.

## Envelope e autorização

Nomes snake_case abaixo representam campos de persistência; na borda de comando aplicar o envelope camelCase global `requestId`/`expectedRevision`, com adaptação explícita, sem dois protocolos concorrentes.

DTO compartilhado em `packages/shared/src/orcamento-operacional-contracts.ts`; validar tipos e presença na borda. request_id UUID obrigatório nas escritas e expected_revision obrigatório em alteração de objeto existente. Cliente/autor derivam da sessão e vínculos oficiais; ler Conta e ação no servidor. Retentativa idêntica retorna resposta anterior; request_id com conteúdo diferente é conflito. Permissão negada usa 403 sem dados internos; objeto fora de escopo não permite enumerar outra Conta.

## Eventos e consultas

Evento append-only inclui tipo, objeto, origem, autor, data, request_id, revisão e motivo quando aplicável; nunca custos em canal público. Consultas paginadas com filtro Cliente/status/período e cancelamento; envelopes não expõem tabelas privadas. Ver contrato global `docs/planejamento/plano-manutencao/contratos-programa.md`.

## Cenários verificáveis

- US1: AC-1, AC-2 — Custo R$100 gera sugestão R$150 e cliente recebe somente descrição/preço autorizados.
- US2: AC-3, AC-4 — Enviar, aprovar e complementar proposta; dispensar outra com motivo.
- US3: AC-5, AC-6 — Decidir orçamento legado duas vezes e emitir novo pela OS existente.

