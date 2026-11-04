# ADR-1004 — Escritores adicionais durante reserva Equipment

Status: preparação privada, não homologada.

Ampliar a guarda da reserva para alterações dos identificadores Auvo do Componente e exclusão ou desativação da categoria. A leitura do gate deve ser travada durante a transação para evitar que a ativação ou desativação atravesse a verificação. Quando não houver reserva, as escritas continuam com comportamento anterior; sem gate ativo, nenhuma alteração de fluxo é pretendida.

A guarda também bloqueia a gravação normal dos IDs Auvo durante uma reserva. O worker não deve ser conectado até existir comando de confirmação atômico e autenticado que concilie ID, outbox e reserva, sem liberar resultado incerto. Verificar efeitos de triggers legados, ordenação de locks e todas as fontes de alteração; funções e gate permanecem fechados. Esta preparação não comprova ausência de todas as corridas nem libera envio.
