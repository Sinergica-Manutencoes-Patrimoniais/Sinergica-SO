# ADR-0488 — identidade de evento e duplicação de fila

Status: bloqueado para implementação segura; diagnóstico estático, não aplicado nem homologado.

Na estrutura de `0024`, o UUID identifica a linha de outbox, enquanto `entity`, `row_id` e `op` identificam objeto e tipo de operação, não o evento de negócio. Dois updates legítimos do mesmo objeto têm os mesmos três campos. Inserir outra linha também gera UUID diferente e não prova que seja reentrega da mesma ação. Portanto uma unicidade nesses campos ou bloqueio de nova linha com estado incerto descartaria trabalho legítimo, sem impedir duplicação por outros caminhos.

Antes de proteção de reentrega é necessário estabelecer identidade estável no produtor do evento, contrato de idempotência e correlação de resultado remoto com fencing, preservando eventos distintos e registros legados. Todos os produtores, chamadas diretas e reconciliação devem ser inventariados; uma identidade nova não pode ser retroativamente inferida. O gate 0711 continua desligado e não cobre inserções. Nenhum retry, remoção, mutação de fila ou migração de deduplicação é realizado nesta etapa.

A migration 0714 prepara apenas uma amostra agregada de coincidências de entidade, objeto e operação no escopo do Cliente. Coincidência pode representar alterações distintas; não é prova de duplicata, ausência de efeito ou motivo para bloquear. O limite aplica-se às primeiras 1.000 linhas autorizadas, não ao universo completo; erros de leitura não são tratados como zero.
