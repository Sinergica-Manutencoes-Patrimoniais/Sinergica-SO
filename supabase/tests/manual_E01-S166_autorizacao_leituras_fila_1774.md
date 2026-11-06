---
name: "supabase-tests-manual-e01-s166-autorizacao-leituras-fila-1774-md"
description: "Documento Sinérgica SO: Leituras da fila e revogação — 1774"
alwaysApply: false
---

# Leituras da fila e revogação — 1774

Em clone descartável com migrations até 1772, fixtures sintéticas de Grupo/Calendário e Visita forneceram uma linha por fila. As funções autenticadas `sso_listar_fila_preventiva_pcm` e `sso_consultar_fila_visita` foram temporariamente instrumentadas no clone com uma pausa de quatro segundos após a autorização e antes da leitura. Nas duas, uma sessão revogou `plano.gerir` e confirmou durante essa pausa; a leitura então retornou uma linha. A pausa só força uma intercalação possível e não faz parte da migration.

Restauradas as funções, aplicou-se 1774. Para cada leitura, as duas ordens foram ensaiadas: a primeira transação ficou aberta por quatro segundos e a operação concorrente recebeu `55P03`/`autorizacao_em_alteracao`; todas foram revertidas. As listagens preventiva v2 e v3 retornaram a linha esperada; chamadas com ator sem concessão ao Cliente foram recusadas com `42501` nos dois modos. Uma transação REPEATABLE READ foi recusada com `25001`. Revisão independente não encontrou bypass de escopo ou ACL.

Roteiro: preparar fixtures sintéticas `manual_E01-S166_grupo_fila_afirmacao.sql` até antes da declaração e `manual_E01-S165_aprovacao_real_visita_1731.sql` até antes da aprovação em banco descartável; confirmar apenas dados de teste. Instrumentar cada leitura temporariamente após autorização; revogar e confirmar em sessão paralela; restaurar código e aplicar 1774; repetir concorrência nas duas ordens, manter primeira transação aberta e reverter ambas. Testar v2/v3, Cliente não autorizado e isolamento. Após os ensaios o banco foi removido. Sem deploy, OS ou Auvo. Não prova todas as leituras, consumidores ou transações em produção.
