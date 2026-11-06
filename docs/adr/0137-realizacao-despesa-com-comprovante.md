# ADR-0137 — Realização de despesa e comprovante privado

**Estado:** proposta preparatória, sem homologação nem implantação.

Registrar a realização sobre a previsão existente, sem lançamento financeiro, exige revisão esperada, autorização da despesa no Cliente e comprovante existente em bucket privado dedicado. A gravação conserva o valor previsto, salva valor realizado em centavos e associação imutável do comprovante, com autor, request_id e auditoria na mesma transação. Um pedido idêntico é idempotente; outra realização exige fluxo explícito de correção ainda não definido.

O objeto deve estar no caminho reservado `<cliente UUID>/<despesa UUID>/<objeto UUID>` de `sso-despesas-visita`, e não pode estar vinculado a outra despesa. O bucket não é criado nem aberto aqui. O comando não concede acesso a arquivos nem cria URL assinada; permanece revogado para todos os papéis de aplicação.

Antes de habilitar: criar fluxo de upload privado com comprovação de autoria e vínculo do objeto, leitura via rota segura, retenção e exclusão controladas, permissões por Conta e revogação, garantias de integridade do conteúdo, rateio, conciliação financeira e regra para correção/estorno. O caminho e privacidade do bucket isoladamente não comprovam autoria ou integridade. Testes de RLS, concorrência, idempotência e revisão adversarial são obrigatórios. O caminho legado que já aceita realizado na criação deve ser reconciliado antes de liberar a funcionalidade.
