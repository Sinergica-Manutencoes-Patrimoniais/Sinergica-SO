# ADR-1340 — Esforço restante explicitamente declarado para continuidade

**Estado:** proposta; não aplicada nem homologada.

## Contexto

Uma OS de continuidade pode ter duração restante informada sem quantidade de pessoas ou separação de execução própria, terceiros e acompanhamento. A declaração genérica de esforço da OS também não informa se representa trabalho restante. Nenhuma dessas fontes isoladamente autoriza somar HH restantes.

## Decisão

Preparar declaração explícita do PCM vinculada a uma revisão imutável da declaração de esforço e a uma proposta de continuidade efetivamente associada à OS. A declaração confirma que as três parcelas informadas são somente o esforço restante. Uma nova revisão de esforço deixa de ter essa confirmação até nova conferência. O comando exige capacidade, Cliente, revisão atual, idempotência e auditoria. Não converte automaticamente duração em HH nem presume execução física.

## Limites

A integração ao subtotal deve deduplicar OS e ocorrências e só usar a confirmação correspondente à revisão consultada; fonte incompleta permanece incompleta. Validar locks com alteração de esforço e continuidade, revogação, histórico, permissões, correção dos vínculos e revisão adversarial antes de habilitar. Não é aceite operacional nem comprova conclusão.
