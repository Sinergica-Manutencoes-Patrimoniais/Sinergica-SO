---
name: "docs-adr-1479-impactos-ciclos-reutilizados-md"
description: "Documento Sinérgica SO: ADR-1479 — Impactos incluem ciclos reutilizados por versão"
alwaysApply: false
---

# ADR-1479 — Impactos incluem ciclos reutilizados por versão

## Contexto
A materialização S166 pode registrar que uma versão posterior usa ocorrência criada por versão anterior, sem reescrever a ocorrência. Consultas e decisões S165 filtravam apenas a versão gravada na ocorrência. Assim, outra revisão poderia omitir ciclos ainda usados pela versão anterior.

## Decisão
Para decisões, listagens, avaliação e selos de continuidade, considerar ocorrência originada na versão anterior ou referenciada explicitamente por uso canônico dessa versão. Preservar a versão e os dados originais da ocorrência. Acrescentar índices por versão e ocorrência nos vínculos de uso. Modificações são verificadas contra a definição instalada e abortam em caso de divergência.

## Limites
Vínculo de uso não comprova cobertura de PMOC ou legado, nem corrige outros consumidores. Homologação requer teste em três versões, repetição, acesso, concorrência, Visita e calendário, avaliação de índices e revisão adversarial; guardas atuais permanecem fechadas.
