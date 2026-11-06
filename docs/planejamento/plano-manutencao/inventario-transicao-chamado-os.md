---
name: "docs-planejamento-plano-manutencao-inventario-transicao-chamado-os-md"
description: "Documento Sinérgica SO: E01-S167 — Inventário inicial da transição Chamado 1:N OS"
alwaysApply: false
---

# E01-S167 — Inventário inicial da transição Chamado 1:N OS

Estado: análise local, não exaustiva; não é aprovação, migração ou inventário de produção.

## Escritores e restrições identificados

- `supabase-ordem-servico-adapter.ts` cria Chamado, eventos, OS e referência singular em requisições distintas; o helper de confirmação de backlog também atualiza `chamado_id` e `numero` explicitamente.
- `application/chamados.ts` consulta uma OS anterior e a trata como repetição antes de marcar estado e referência; sem requestId transacional, não distingue retry de intenção legítima de criar outra OS. A consulta usa `maybeSingle()` e não aceita múltiplos resultados.
- Conversão de orçamento (`0151`), importação Auvo (`pcm-auvo-tasks-import`), helper `os-from-task` e agente Zé também criam ou referenciam OS e/ou Chamados. Sua ordem de chamadas e contrato externo precisam de inventário específico; nenhuma execução Auvo real é autorizada.
- Índice `uq_ordens_servico_chamado` (`0171`) impede segunda OS não excluída. Trigger de `0209` preenche o número da OS com o número do Chamado ao inserir; a coluna de número é única, inclusive para registros excluídos. Remover apenas o índice de Chamado ainda deixa colisão de número.
- Referência `chamados.ordem_servico_id` persiste como legado. A leitura 0312 faz fallback apenas quando não há ambiguidade, sem corrigir dados e sem liberar escrita 1:N.

## Leitores e compatibilidade

- A view `pcm.operacao_itens` (0208) emite um registro por OS e só emite card de Chamado aberto sem OS; não apresenta um único card gerencial com progresso de múltiplas OS. Hub, quadro, Cliente360 e Portal dependem de leituras existentes; identificar cada consumidor antes de mudar o contrato.
- Telas exibem números atuais como identificadores históricos. Preservar integralmente números de Chamado e OS já emitidos, UUIDs, links, tarefa Auvo e referências anteriores. A forma de identificar novas OS e exibir o Chamado junto delas precisa de desenho explícito e verificação com consumidores; nenhuma renumeração em massa.
- Existem dados legados sem vínculo reverso e inconsistências entre Clientes ou referências; a transição não deve inferir propriedade, apagar registro ou escolher um vencedor. Inventário e reconciliação auditada antecedem a liberação.

## Investigação de integridade por Cliente

Uma FK composta `ordens_servico(chamado_id, client_id)` para `chamados(id, cliente_id)`, declarada `NOT VALID`, é candidata para impedir novos vínculos cruzados sem validar imediatamente o estoque legado. Ela, porém, não constitui solução 1:N e não está pronta para aplicação: também restringe a alteração do Cliente do Chamado enquanto houver OS referenciada, inclusive OS excluída logicamente. Um experimento em tabelas temporárias, com fixtures sintéticas e rollback, confirmou essa restrição e a rejeição de um novo vínculo com Cliente divergente. Não é prova de compatibilidade com os fluxos reais ou com o histórico de produção.

Em experimento separado, a linha divergente foi confirmada antes da criação da FK: atualizar apenas um campo não relacionado foi permitido. Quando a linha divergente havia sido inserida na mesma transação, essa atualização foi rejeitada. Os experimentos usam tabelas temporárias, não tabelas do sistema: não comprovam todas as formas de atualização dos escritores reais. Avaliar separadamente correção de registros históricos, exclusão lógica, troca legítima de Cliente, locks, criação e confirmação pelo adapter web, conversão comercial, importação Auvo e demais escritores, inclusive efeitos parciais onde as chamadas são separadas. Os testes legados que caracterizam aceitação de divergência também precisam ser adaptados apenas quando houver uma política de migração aprovada. Até existir essa prova, não criar a FK nem alterar gate ou restrições legadas.

## Sequência proposta

1. Inventariar produtores, consumidores, números, vínculos singulares/inversos, duplicações e referências externas em ambiente apropriado; definir tratamento de inconsistências sem mutação automática.
2. Adicionar leitura 1:N segura e indicadores de cobertura, mantendo compatibilidade com leitores antigos. Substituir chamadas singulares e migrar a visão gerencial antes de liberar segunda OS; preservar listas executáveis individuais.
3. Projetar identificador de novas OS independente do número preservado do Chamado e compatibilidade do trigger. Definir explicitamente política de exibição e não alterar números legados. Validar impacto em integrações e consumidores antes de qualquer alteração de restrição.
4. Implementar comando transacional com autorização atual por Cliente, revisão, requestId, lock de Chamado e reserva concorrente de identidade, mantendo eventos e auditoria na transação. Retry idêntico retorna a mesma OS; pedidos distintos podem criar OS distintas. Sem envio Auvo.
5. Testar duas sessões, rollback, colisão de números, referência legado ambígua, revogação, Cliente divergente, pedidos diferentes, repetição de payload e concorrência com encerramento. Validar leituras de Portal/Cliente360/Hub, CI/db-tests e revisão adversarial antes do rollout.
