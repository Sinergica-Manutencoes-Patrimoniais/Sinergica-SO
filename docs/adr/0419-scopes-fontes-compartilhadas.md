---
name: "docs-adr-0419-scopes-fontes-compartilhadas-md"
description: "Documento Sinérgica SO: ADR-0419 — aquisição ordenada para fontes compartilhadas"
alwaysApply: false
---

# ADR-0419 — aquisição ordenada para fontes compartilhadas

Status: proposto; não aplicado nem homologado.

O adaptador de funcionários desativa diretamente a linha e marca sincronização Auvo pendente; envolver essa operação sem confirmar permissões e efeitos da sincronização não é seguro. Há escritores de OS por SQL e integrações, além de rotas de aplicação. A fonte não pode ser bloqueada antes dos escopos das Visitas: isso inverteria a ordem dos escritores de composição.

A função interna preparada consulta os vínculos ativos, bloqueia escopos de Visita por UUID, bloqueia a fonte e relê o conjunto. Se mudou, aborta a transação; um consumidor futuro deve manter esses locks até a escrita. É uma peça de protocolo, não uma API de alteração e não revoga a barreira 0642. É necessário confirmar que TODOS os escritores de vínculo e fonte usam esse protocolo e que a leitura subsequente vê novos commits sob o isolamento adotado. Chamadas diretamente à tabela, privilégios, paginação/volume, gatilhos Auvo, deadlocks e semântica da confirmação exigem auditoria e testes de integração. Não habilitar gates nem acionar Auvo.
