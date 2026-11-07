---
name: "docs-adr-1056-progresso-job-varredura-md"
description: "Documento Sinérgica SO: ADR-1056 — Progresso persistente da varredura"
alwaysApply: false
---

# ADR-1056 — Progresso persistente da varredura

**Status:** preparação privada, não homologada. Complementa ADR-1054/1055.

Cada execução mantém cursor e revisão no banco. O avanço recebe requestId e revisão esperada; bloqueia a execução, processa uma página e grava recibo e novo cursor na mesma transação. A mesma requisição retorna o recibo anterior; conteúdo diferente ou revisão obsoleta é recusado. Uma execução finalizada não avança novamente. Nova varredura usa outra identidade e começa no início, pois UUIDs inseridos durante a execução podem estar antes do cursor.

Somente o serviço pode executar a RPC, ainda dependente dos gates fechados da varredura e observação. Não configura agendamento, não verifica lease e não consulta ou altera Auvo. Revisar propriedade/RLS, falhas e concorrência, volume, retenção, autenticação, métricas e revisão adversarial antes de habilitar. A cobertura continua limitada a Sistemas e Componentes.
