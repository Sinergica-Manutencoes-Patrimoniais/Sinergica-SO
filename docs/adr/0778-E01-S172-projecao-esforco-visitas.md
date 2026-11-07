---
name: "docs-adr-0778-e01-s172-projecao-esforco-visitas-md"
description: "Documento Sinérgica SO: ADR-0778: projeção parcial de esforço de OS em Visitas"
alwaysApply: false
---

# ADR-0778: projeção parcial de esforço de OS em Visitas

Status: proposta, gates fechados e homologação pendente.

Para evitar N+1 e somas de terceiros na equipe própria, projetar em cada página autorizada de fontes de Visita a última declaração explícita da mesma OS e Cliente. Reutilizar a mediação 0979, a função 0356 e as declarações append-only 0977; todos seus gates e autorização permanecem obrigatórios. A projeção não lê ocorrências não vinculadas e não comprova disponibilidade ou esforço realmente executado.

Na tela, consolidar somente as linhas carregadas e uma vez por OS. Se a mesma OS apresentar declarações/revisões divergentes, excluí-la do subtotal e sinalizar conflito; campos nulos ou zero sinalizam incompletude. Minutos de acompanhamento entram no subtotal interno, terceiros permanecem separados. O subtotal não é saldo, não garante cobertura de páginas, programação ou duplicidade OS/ocorrência; nunca afirmar demanda completa. Consulta não modifica histórico nem presume execução.
