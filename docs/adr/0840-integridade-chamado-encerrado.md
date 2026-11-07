---
name: "docs-adr-0840-integridade-chamado-encerrado-md"
description: "Documento Sinérgica SO: ADR-0840 — Serialização de escritores de OS com encerramento"
alwaysApply: false
---

# ADR-0840 — Serialização de escritores de OS com encerramento

Estado: proposta local, não homologada. Complementa ADR-0839. Gate continua fechado.

**Atenção: os triggers propostos na migration 1028 são incondicionais.** Se a migration for aplicada, eles passam a atuar imediatamente em `pcm.ordens_servico` e `pcm.chamados`, mesmo com os gates de criação múltipla e de encerramento fechados. Gates fechados não tornam a migration inerte e não desativam essas guardas. A migration não deve ser aplicada permanentemente até concluir o inventário, a validação de compatibilidade e a revisão do rollout.

Em cluster isolado e rede interna, uma sessão fechou um Chamado com OS legada finalizada e outra iniciou inclusão direta de OS em execução. O INSERT aguardou o lock do Chamado, mas após o commit do fechamento foi aceito; resultado: Chamado encerrado com OS em execução. Os comandos eram cópias temporárias e gates reais permaneceram fechados. A verificação da FK não valida estado de encerramento.

Adicionar guardas que bloqueiem a associação de OS a Chamado encerrado, exclusão física ou lógica, mudança de Cliente/vínculo e reabertura de status para estado não finalizado. Os guardas bloqueiam os Chamados relacionados antes de verificar seu estado, inclusive a relação singular. Mudança da referência singular também deve bloquear a OS e verificar se a OS já pertence ou é referenciada por Chamado encerrado. Reabertura formal permanece o caminho para alteração de escopo após fechamento. Atualizações que não alteram associação, exclusão lógica ou status de OS permanecem permitidas; encerramento e histórico existentes não são modificados.

As guardas não resolvem toda a migração 1:N, nem provam compatibilidade dos demais consumidores e integrações. Exigem testes de duas sessões em ambas as ordens, conflitos, exclusão e reabertura, revisão adversarial e CI antes de qualquer ativação. O rollout deve avaliar dados e fluxos legados; o gate permanece fechado. Rollback funcional requer migração posterior removendo as guardas, com retorno da corrida aqui demonstrada.

## Impacto e bloqueio de rollout

- Escritores legados web, Auvo, importações e outros caminhos que gravam diretamente nas tabelas podem passar a receber `23514` ao incluir ou desvincular OS, mudar Cliente ou identificador, excluir/restaurar, reabrir status ou modificar referência singular envolvendo um Chamado já encerrado. Isso pode interromper processos que hoje permitem essas operações, inclusive integrações em chamadas separadas.
- Os `FOR SHARE`/`FOR UPDATE` acrescentam contenção e podem produzir espera ou deadlock com fluxos que usam outra ordem de locks. São necessárias medições, testes concorrentes dos escritores reais e tratamento explícito de erros/retry; o teste isolado não prova compatibilidade de produção.
- Foram exercitadas operações sintéticas permitidas e negadas, e a corrida de inclusão nas duas ordens, em cluster descartável. Ainda faltam inventário dos registros encerrados, validação de correções e reabertura formal, corridas envolvendo UPDATE/DELETE/referência singular, efeitos em integrações e revisão adversarial. Não há evidência de que todos os fluxos legítimos sejam preservados.
- **Rollout bloqueado:** manter a migration apenas como proposta local; não aplicar em banco compartilhado ou produção nem liberar gates até concluir essas verificações e aprovação operacional. Desligar gate após eventual aplicação não reverte os triggers; a reversão exige migration própria, validada para a ordem de deploy.
