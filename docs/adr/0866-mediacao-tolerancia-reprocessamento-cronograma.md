---
name: "docs-adr-0866-mediacao-tolerancia-reprocessamento-cronograma-md"
description: "Documento Sinérgica SO: ADR-0866 — Tolerância e reprocessamento de cronograma"
alwaysApply: false
---

# ADR-0866 — Tolerância e reprocessamento de cronograma

Status: preparado, gates fechados e homologação pendente.

Tolerância por mapeamento e reprocessamento passam pela mediação autorizada do staging canônico, sem conceder execução direta dos núcleos privados. A gravação exige revisão atual; ausência de tolerância equivale a zero e uma mudança posterior exige nova conferência. Proposta e aplicação exigem lote aprovado e Plano rascunho nas revisões esperadas, com histórico e replay transacionais. Travas compartilhadas dos gates de staging, aprovação e incorporação serializam alteração durante proposta e aplicação.

A consulta privada de propostas tinha nomes de colunas ambíguos; qualificamos as referências em substituição que falha caso a definição esperada tenha mudado. Nenhum gate é ativado; revisão adversarial, concorrência e homologação continuam pendentes.
