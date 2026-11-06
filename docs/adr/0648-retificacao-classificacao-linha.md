# ADR-0648 — Retificação solicitada de classificação

Retificação é evento imutável, separado da classificação e revisão originais, com tipo proposto, motivo e ator. Não substitui o tipo publicado, não constitui aprovação PCM nem autorização de faturamento. Para não presumir que todas as origens financeiras estão vinculadas à proposta, o pedido bloqueia conservadoramente se existir qualquer item faturável do Cliente; não deduz ausência de faturamento de consultas parciais. Isso pode impedir correções legítimas e precisa de reconciliação de fontes antes de flexibilizar.

Lock compartilhado da tabela de itens serializa a conferência com inserções enquanto o pedido é gravado; não impede faturamento posterior. O registro não é aplicado automaticamente e sua revisão/efetivação exige nova etapa e conferência transacional. Gate fechado; revisar lock amplo, escritores, migrações e testes antes de ativar.
