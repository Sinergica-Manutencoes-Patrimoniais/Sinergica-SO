# ADR-0118 — Preparação da segunda aprovação com vigência

**Estado:** proposta não aplicada, não testada e não habilitada. Complementa ADR-0089.

## Decisão

Preparar comando privado, com gate fechado, que bloqueia Plano e última versão aprovada, fecha vigência anterior no dia anterior à nova e delega snapshot, validação, revisão, idempotência e auditoria ao comando de aprovação existente na mesma transação. Resposta idempotente deve ser reconhecida antes da validação temporal de um novo pedido. A versão anterior precisa ter vigência aberta, início conhecido e data futura finita; nenhuma ocorrência ou tarefa é criada.

A migration 0345 prepara substituição da trigger `sso_bloquear_aprovacao_sem_vigencia`, permitindo a segunda aprovação apenas com token privado vinculado à transação, Plano e datas; outra trigger protege o fechamento anterior, e constraint exclui sobreposição entre versões aprovadas com início conhecido. O comando 0342 cria e remove o token dentro da própria transação. A proteção permanece fechada pelo gate privado e ausência de EXECUTE. O snapshot anterior não é alterado. Dados legados com início ausente ficam fora da constraint e exigem inventário; sobreposições existentes impedem sua aplicação.

## Limites

Sem serialização de revogação, impacto em Ocorrências/OS e revisão de todos consumidores de vigência, não é seguro habilitar. A regra de dia futuro UTC de ADR-0089 é limite técnico provisório, não decisão de negócio. A função não altera frontend nem concede EXECUTE. Validar existência de extensão, instalação da constraint sobre dados reais, propriedade/BYPASSRLS e isolamento do token, Auth/RLS, reentrega, concorrência entre aprovações e mudanças de referências, datas extremas, reabertura e rollback em CI/db-tests e revisão adversarial antes de qualquer aplicação ou liberação. Nenhum dado legado é ajustado automaticamente.
