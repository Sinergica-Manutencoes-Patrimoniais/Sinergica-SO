# Commands and queries — E01-S180

## Contratos

`RegistrarDespesaVisita(request_id, visita_id, categoria_id, data, previsto_centavos, realizado_centavos?, comprovantes[], expected_revision?)`; `RatearDespesa(request_id, despesa_id, parcelas[{os_id,valor_centavos}], expected_revision)`; `CancelarDespesa(request_id, despesa_id, motivo, expected_revision)`. Retornar id + revision + status; repetição idêntica retorna mesmo resultado, request_id reutilizado com conteúdo diferente falha. Motivos de rejeição: visita_nao_encontrada, rateio_inconsistente, os_fora_visita, permissao_negada, despesa_efetivada, revisao_divergente. Vínculo financeiro é contrato compartilhado e não import de feature.

## Envelope e autorização

Nomes snake_case abaixo representam campos de persistência; na borda de comando aplicar o envelope camelCase global `requestId`/`expectedRevision`, com adaptação explícita, sem dois protocolos concorrentes.

DTO compartilhado em `packages/shared/src/despesas-visita-contracts.ts`; validar tipos e presença na borda. request_id UUID obrigatório nas escritas e expected_revision obrigatório em alteração de objeto existente. Cliente/autor derivam da sessão e vínculos oficiais; ler Conta e ação no servidor. Retentativa idêntica retorna resposta anterior; request_id com conteúdo diferente é conflito. Permissão negada usa 403 sem dados internos; objeto fora de escopo não permite enumerar outra Conta.

## Eventos e consultas

Evento append-only inclui tipo, objeto, origem, autor, data, request_id, revisão e motivo quando aplicável; nunca custos em canal público. Consultas paginadas com filtro Cliente/status/período e cancelamento; envelopes não expõem tabelas privadas. Ver contrato global `docs/planejamento/plano-manutencao/contratos-programa.md`.

## Cenários verificáveis

- US1: AC-1, AC-2 — Criar previsão, registrar realizado com comprovante e reenviar o mesmo comando.
- US2: AC-3, AC-4 — Ratear R$100 entre duas OS e comparar total por Visita.
- US3: AC-5, AC-6 — Cancelar registro não contabilizado e tentar alteração por cliente.

