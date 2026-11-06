---
name: "docs-adr-1520-origem-historica-impacto-md"
description: "Documento Sinérgica SO: ADR-1520 — Origem histórica da ocorrência na comparação de revisão"
alwaysApply: false
---

# ADR-1520 — Origem histórica da ocorrência na comparação de revisão

## Contexto

Uma ocorrência de V1 pode ser mantida por V2 e novamente avaliada em V3. Mostrar apenas V2 como versão anterior oculta o snapshot V1 associado à ocorrência e pode levar a uma decisão sem conhecer a instrução ou o questionário de origem.

## Decisão

Acrescentar à comparação já transacional a identidade e a projeção da versão original da ocorrência, além do estado e hash do questionário histórico quando disponíveis. Se snapshot, Rotina ou referência forem incompletos, retornar situação indeterminada; jamais inferir conteúdo ausente. A confirmação existente passa a abranger estes campos, sem alterar ocorrências, históricos, decisão ou guarda 1045.

## Limites

Snapshot histórico não demonstra execução em campo ou integridade das fontes externas. Clientes estritos anteriores precisam de atualização coordenada. Preservar replay das fotografias antigas; validar concorrência e revisar segurança antes de ativar. Sem deploy ou Auvo.
