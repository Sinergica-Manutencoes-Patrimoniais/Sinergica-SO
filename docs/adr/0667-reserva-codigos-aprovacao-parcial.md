# ADR-0667 — Reserva de códigos na aprovação parcial

Status: proposta; gates fechados, não homologada.

A aprovação parcial reserva candidatos novos em transação, com bloqueio comum aos escritores de códigos e verificação de códigos oficiais e aliases. Reservas são protegidas por índice único e vinculadas a lote, linha e ciclo. Uma incorporação autorizada consome somente sua própria reserva; falha reverte reserva, aprovação e efeitos da transação correspondente. Escritores legados não podem apropriar-se de reserva ativa. Alterações preservam os códigos e aliases existentes, sem renumerar legado.

Linhas com código oficial já existente não reservam uma segunda identidade: ficam sujeitas à validação do cadastro de destino na atualização e uma criação colidente continua bloqueada. Grupos ficam fora até definição do namespace. Reabertura não libera automaticamente reserva; reconciliação e liberação auditada permanecem necessárias antes de operação. Aprovação integral não está integrada nesta etapa e não deve ser ativada como substituto. Nenhum gate é habilitado; revisar migrations, concorrência, grants, rollback e efeitos Auvo antes de testes ou aplicação.
