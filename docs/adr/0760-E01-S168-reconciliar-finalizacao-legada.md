# ADR-0760 — Reconciliação somente leitura de finalização anterior

**Status:** preparada, sem aplicação nem homologação. **Data:** 2026-10-30.

## Contexto

Pedidos locais antigos de finalização não guardam a identidade da OS conferida. Repetir sua mutação pode finalizar uma OS cujo vínculo tenha mudado. A prévia atual, isoladamente, não prova qual OS foi conferida anteriormente.

## Decisão

Novos pedidos locais preservam a OS conferida. Wrapper transacional exige o mesmo `osId` antes de chamar a função existente e usa a mesma ordem de locks; o cliente também rejeita resposta para outra OS. Pedidos antigos permanecem guardados e não são repetidos automaticamente. Consulta autenticada, somente leitura, compara ator, Cliente, retorno e payload integral com a finalização auditada existente e retorna o resultado registrado. Ausência não prova que não existe comando em curso e não autoriza nova escrita. Resultado encontrado é histórico do servidor, não reconstrução a partir da prévia atual. As funções permanecem sem concessão a authenticated, atrás dos mesmos gates e da autorização atual de `execucao.validar`.

## Limites

Não envia tarefa Auvo, não altera OS/Chamado e não habilita gate. Requer testes de isolamento e concorrência, revisão adversarial e validação local antes de implantação. A consulta de resultado ausente continua pendente de reconciliação operacional; não apagar pedido nem criar outra tentativa automaticamente.
