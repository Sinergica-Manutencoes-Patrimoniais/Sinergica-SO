---
name: "docs-adr-0608-reconciliacao-intencao-grupo-md"
description: "Documento Sinérgica SO: ADR-0608 — Reconciliação de intenção e OS declarada"
alwaysApply: false
---

# ADR-0608 — Reconciliação de intenção e OS declarada

Uma intenção existente impede vínculo posterior a OS sem decisão humana auditada para aquela OS específica. A decisão não cria vínculo nem altera OS; o comando de vínculo mantém suas próprias autorizações e verificações. Intenção e vínculo serializam pela ocorrência Grupo; 0830 já recusa vínculo preexistente. A decisão é imutável e uma por intenção: correção excepcional requer procedimento adicional.

O gate da decisão inicia desligado, mas a guarda de integridade impede o bypass mesmo assim. Isso não prova equivalência de serviços nem autoriza execução, não resolve ordenação de todos os locks e depende de testes e revisão antes de ativação.
