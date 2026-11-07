# Commands and queries — E01-S182

## Contratos

`ReceberFaturavel(request_id, cliente_id, origem_tipo, origem_id, valor_centavos, competencia, evidencias)` por contrato servidor-servidor; `ConferirItem(request_id, id, valor_centavos, motivo, expected_revision)`; `FaturarItem(request_id, id, documento_ref, data, valor_centavos, expected_revision)`; `CancelarItem`; `EstornarAlocacao`; `CriarComplemento(request_id,item_base_id,complemento_id,valor,motivo)`. Retornos id/status/saldo/revision. Erros: origem_conflitante, saldo_insuficiente, documento_ausente, competencia_fechada, permissao_negada, revisao_divergente. Origem autenticada e valores obtidos de fonte oficial, nunca confiar em Cliente enviando valor.

## Envelope e autorização

Nomes snake_case abaixo representam campos de persistência; na borda de comando aplicar o envelope camelCase global `requestId`/`expectedRevision`, com adaptação explícita, sem dois protocolos concorrentes.

DTO compartilhado em `packages/shared/src/faturaveis-contracts.ts`; validar tipos e presença na borda. request_id UUID obrigatório nas escritas e expected_revision obrigatório em alteração de objeto existente. Cliente/autor derivam da sessão e vínculos oficiais; ler Conta e ação no servidor. Retentativa idêntica retorna resposta anterior; request_id com conteúdo diferente é conflito. Permissão negada usa 403 sem dados internos; objeto fora de escopo não permite enumerar outra Conta.

## Eventos e consultas

Evento append-only inclui tipo, objeto, origem, autor, data, request_id, revisão e motivo quando aplicável; nunca custos em canal público. Consultas paginadas com filtro Cliente/status/período e cancelamento; envelopes não expõem tabelas privadas. Ver contrato global `docs/planejamento/plano-manutencao/contratos-programa.md`.

## Cenários verificáveis

- US1: AC-1, AC-2 — Reprocessar e concorrer dez vezes sobre o mesmo fornecimento.
- US2: AC-3, AC-4 — Conferir e faturar item com documento; repetir pedido.
- US3: AC-5, AC-6 — Cancelar antes e estornar depois; adicionar complemento com referência.

