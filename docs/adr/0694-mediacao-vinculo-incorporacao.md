---
name: "docs-adr-0694-mediacao-vinculo-incorporacao-md"
description: "Documento Sinérgica SO: ADR-0694 — Mediação de vínculo e incorporação"
alwaysApply: false
---

# ADR-0694 — Mediação de vínculo e incorporação

Os comandos de vínculo a ativo, incorporação com código de staging, atualização de Localização e aplicação de seleções usam mediadores autenticados, sujeitos ao gate da ADR-0687 e à autorização `cadastro.aprovar` para o Cliente do lote. Os núcleos permanecem revogados e mantêm suas travas, gates, revisão, idempotência e auditoria; nenhum mediador envia dados ao Auvo.

A repetição de incorporação com código de staging registra o payload original e o resultado atomicamente em tabela privada. Após autorização atual e lock do request, o mesmo ator e payload recuperam o resultado antes de consultar o estado mutável do staging; divergência é rejeitada. Essa alteração pressupõe migrations ainda não aplicadas, sem reconstruir histórico de execuções anteriores.

A ativação requer revisão de segurança, grants, concorrência, repetição após resultado incerto e supressão real de sincronização. Consultas e outros comandos não são liberados automaticamente.
