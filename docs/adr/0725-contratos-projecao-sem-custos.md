# ADR-0725 — Contratos pela projeção sem custos

**Status:** proposta implementável para diagnóstico; homologação e rollout bloqueados.

## Decisão

Preservar `SECURITY INVOKER`, permissões e RLS dos comandos comerciais de contrato. As leituras de proposta necessárias à criação e à ativação passam pela visão existente `comercial.propostas_sem_custos`, sem consultar composição ou custos. O escopo global por módulo das políticas legadas é preservado, sem criar nova concessão por Cliente.

Ao ativar, verificar antes da criação de plano a proposta, a oportunidade e a existência de etapa ganha utilizável; bloquear a oportunidade durante a transação e exigir que a operação termine em etapa ganha. Erro de leitura, atualização ou criação financeira desfaz integralmente a ativação. Preservar identificadores, histórico e contratos financeiros, inclusive os legados. Nenhuma migration cria plano ou gera cobrança.

## Limites e validação

Não alterar funções Financeiro, assinaturas ou credenciais. A versão atual das funções financeiras e do acesso direto Financeiro mantém as limitações registradas na ADR-0724, inclusive vinculação financeira arbitrária e falta de revisão de consumidores externos. Esta alteração não demonstra segurança integral do fluxo ou habilita produção.

Testar em banco descartável, com contas sintéticas e rollback, a criação por Comercial autorizado sem acesso a custos, ativação atômica com plano e oportunidade ganha, recusa e rollback quando não houver etapa ganha, revogação, preservação de contratos legados e negação a leitor. Aplicar a migration apenas após reconciliação do histórico, CI com db-tests e revisão adversarial. Reverso: restaurar definição compatível anterior em migration compensatória, sem excluir contratos, planos ou histórico; a definição anterior é funcionalmente bloqueada por S184.
