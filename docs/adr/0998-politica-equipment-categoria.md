# ADR-0998 — Política de Equipment por categoria

Status: preparação privada, não homologada.

Preparar política global por ID de categoria existente, com revisão, responsável e configuração explícita para Equipamento controlado. Sistema deve ser representado como Equipment; Grupo Quantitativo permanece no SSO; Componente sem classificação controlada permanece no SSO. Vínculo remoto existente nunca é apagado ou tratado automaticamente como autorização para criar outro.

O cadastro legado de Componentes possui categoria textual; não presumir correspondência pelo nome com `equipamento_categorias`. É necessário mapeamento confiável antes de aplicar política ao dispatcher. A preparação não altera o enqueue, não suspende sincronização legada e não cria, atualiza ou exclui Equipment. Gestão requer superadmin ativo, auditoria e concorrência; gate e EXECUTE fechados. Revisar integração com fila pendente, idempotência, revogação, migração, RLS, classificação e contrato Auvo antes de operação.
