---
name: "docs-adr-1054-varredura-fila-local-md"
description: "Documento Sinérgica SO: ADR-1054 — Varredura local e auditada da fila"
alwaysApply: false
---

# ADR-1054 — Varredura local e auditada da fila

**Status:** preparação privada, não homologada. Complementa ADR-1051/1052.

Uma página transacional percorre Sistemas e Componentes com Cliente identificável e registra a mesma ocorrência e histórico usados pela conferência humana. O processo é identificado como job, sem atribuir a ação a uma pessoa. O cursor limita trabalho; uma nova execução deve começar sem cursor, pois inserções com UUID menor podem ocorrer durante uma varredura. Um request identifica a página e seu resultado imutável, permitindo repetição após resposta perdida.

O estado remoto permanece desconhecido. Não há lease confiável, varredura de OS/Comercial/Financeiro, fechamento automático, retentativa ou chamada Auvo. A função não recebe EXECUTE operacional, o gate começa fechado e não se cria cron. Autenticação do job, limites, retenção, ownership/RLS, transferência de Cliente, concorrência com todos os escritores, isolamento e revisão adversarial precisam ser comprovados antes de qualquer habilitação. Não aplicar isoladamente em ambiente oficial.
