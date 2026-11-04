# ADR-0133 — Resolução conservadora de envelopes de campo

**Status:** proposta, não aplicada nem homologada.

## Contexto

A inbox privada de E01-S175 recebe envelopes idempotentes, mas não comprova vínculo ao Cliente ou à OS. Webhook e importador legados continuam ativos e não usam a inbox. O contrato do identificador e da ordenação de eventos Auvo ainda não foi comprovado.

## Decisão

Preparar comando privado que, sob o gate fechado da inbox e exclusivamente para serviço, resolve cada envelope pela identidade `auvo_task_id` já persistida e pelo `auvo_id` do Cliente. Resultado de cada tentativa é registrado sem gravar ou modificar Chamado, OS, status, evidências ou cadastro. Cliente ausente, vínculo divergente e OS inexistente permanecem pendentes com causa explícita. Retry registra nova tentativa, permitindo recuperar Cliente sincronizado depois. Nunca procurar Chamado em texto livre nem concluir execução a partir de timestamp não comprovado. Não conceder execução nem integrar ao webhook nesta migration.

## Consequências e gates

Resolução positiva não significa evento aplicado. Continuam necessários criação atômica de provisório e OS, concorrência e reentrega, origem por campo, validação PCM, ligação estruturada ao staging e contrato real Auvo. Antes de habilitar: revisão adversarial, autenticação e exposição mínima, semântica de ordenação, testes com banco e integração; rollout coordenado com os caminhos legados. Nenhuma tarefa externa deve ser criada por este comando.
