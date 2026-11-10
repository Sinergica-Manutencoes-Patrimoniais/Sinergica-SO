---
name: "docs-adr-0097-namespace-codigos-legados-md"
description: "Documento Sinérgica SO: ADR-0097 — Proposta de transição do namespace de códigos"
alwaysApply: false
---

# ADR-0097 — Proposta de transição do namespace de códigos

## Estado

Proposta em análise para E01-S177. Não habilita reserva, proteção, correção ou rollout. Não declara todos os escritores inventariados nem uma chave canônica decidida.

## Evidências atuais

Componentes usam `pcm.equipamentos.identificador` e Sistemas usam `pcm.sistemas.codigo`. Os índices da migration 0221 só são únicos dentro de cada tabela, para o formato novo e registros não excluídos. Os adapters web criam e atualizam essas colunas diretamente; o importador legado usa os mesmos fluxos. Os registries de entrada do Auvo também mapeiam o identificador externo para essas colunas, e o upsert dinâmico pode gravá-las. É necessário ainda inventariar importações, jobs, RPCs, usuários com privilégios, consumidores de QR e fontes de etiqueta/OS; essa lista não é prova de cobertura completa.

Um índice exclusivo em tabela nova de aliases não controla os códigos já existentes nas duas tabelas. Bloqueios somente na RPC de correção não serializam gravações legadas. Ativar triggers de rejeição antes da reconciliação pode bloquear ou rejeitar silenciosamente importações e retornos Auvo. Não se deve escolher um vencedor para duplicações existentes, renumerar cadastros ou remover vínculos remotos.

## Direção para implementação

- Inventariar códigos, seus donos e as colisões sem alterar valores. A 0317 produz somente contagens, não reconciliação. Definir formalmente comparação e tratamento de valores legados diferentes por caixa ou espaços antes de tornar qualquer chave normalizada autoritativa.
- Reconciliar divergências com intervenção autorizada e auditável, preservando código original, UUID e histórico. Fonte externa ou proximidade de data não comprovam que dois registros são o mesmo ativo.
- Projetar reserva e histórico de aliases no mesmo namespace dos códigos atuais, incluindo códigos usados/excluídos que não possam ser reciclados. Toda escrita, inclusive inbound Auvo e importação, deve participar da mesma serialização; nenhuma verificação apenas em navegador ou cache é suficiente. Alteração e alias anterior, motivo, ator, revisão, requestId e auditoria devem fazer parte da mesma transação.
- Prever regime de compatibilidade anterior ao bloqueio: identificar escritor, registrar divergências e impedir apenas o que não puder ser conciliado sem perda; tratamento do inbound, quarentena e recuperação precisam de contrato e teste específicos. Nunca descartar nem substituir silenciosamente o identificador remoto.
- Antes de implementação que habilite escrita, provar com duas sessões a disputa entre criação de Sistema, criação de Componente e reserva de alias no mesmo código, retry idêntico e divergente, revogação, rollback, mudança concorrente e conflito com dados legados. Estabelecer ordem de locks única e avaliar deadlocks, volume, isolamento entre Clientes e falha de integração.

## Próximo passo seguro

Não criar tabela supostamente exclusiva desconectada dos escritores atuais, nem habilitar gatilhos nesta etapa. Implementar e revisar uma estratégia de expansão com inventário completo dos escritores e tratamento de conflito externo; só então elaborar migration e testes de concorrência. A conferência local de código/alias é informativa, depende de leitura completa e não reserva código nem comprova autorização.
