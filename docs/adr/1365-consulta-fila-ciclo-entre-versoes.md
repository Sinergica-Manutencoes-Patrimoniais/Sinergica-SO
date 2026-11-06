---
name: "docs-adr-1365-consulta-fila-ciclo-entre-versoes-md"
description: "Documento Sinérgica SO: ADR-1365 — Entrada preventiva pela identidade canônica"
alwaysApply: false
---

# ADR-1365 — Entrada preventiva pela identidade canônica

**Estado:** proposta; não aplicada nem homologada.

## Decisão

A consulta direta da fila resolve a ocorrência preparada ao ciclo canônico e consulta a entrada desse ciclo, ainda que a entrada tenha sido registrada por outra versão da Rotina. Ela exige vínculo canônico e verifica Cliente, Plano e referência de origem. A interface informa quando a entrada pertence a outra ocorrência e, após confirmação explícita, pode cancelar usando a identidade original e revisão devolvidas pelo servidor. O pedido persistido preserva também a ocorrência de contexto para recuperação sem misturar abas ou versões. Nenhuma versão é alterada ou substituída.

## Limites

Ausência de identidade, referência inconsistente ou falta de acesso gera erro, não conclusão de ausência de execução. A consulta não prova cobertura de fontes, não altera estado, não cria OS e não conclui a fila executável. Validar autorização/revogação, concorrência, integridade entre versões e histórico, além de testes e revisão adversarial antes da implantação.
