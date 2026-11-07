---
name: "docs-adr-1374-candidato-servico-origem-md"
description: "Documento Sinérgica SO: ADR-1374 — Candidato de serviço por fato e exclusão de origens conhecidas"
alwaysApply: false
---

# ADR-1374 — Candidato de serviço por fato e exclusão de origens conhecidas

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Preparar produtor transacional de item pendente por fato de serviço, usando quantidade e preço congelados da declaração aceita, classificação de serviço revisada e atestação PCM atual. A identidade do item é o fato estável; reenvio usa request e carga idênticos, e carga diferente para o mesmo fato retorna divergência, sem substituir valor. A competência precisa estar aberta. O comando não cria documento, recebível, cobrança ou chamada externa.

Intertravamento no banco serializa e impede coexistência de candidato de serviço com item de proposta integral da mesma proposta ou item de material da mesma linha, inclusive na ordem inversa de criação. Não apaga itens cancelados ou complementos para liberar reutilização. Um gate de criação inicia fechado e o novo tipo de item não pode ser conferido ou faturado enquanto a validação transacional específica ainda não existir.

Decisões de reconciliação serviço/material já registradas também são verificadas: a última decisão de cada par deve declarar fatos distintos e corresponder à revisão atual do material. Falta de fotografia, alteração posterior ou decisão inconclusiva bloqueia o candidato. Isso não supõe que todos os materiais tenham sido reconciliados nem que a declaração humana prove exclusividade.

## Limites

O vínculo e a atestação são declarações humanas; não provam execução física nem a equivalência de todos os eventos legados. O intertravamento cobre apenas as três origens explicitamente citadas, não todo o universo de despesas ou integrações externas. Não ativar o gate antes de inventariar todos os produtores e consumidores, completar a validação de conferência/alocação e testar ACL/RLS/FORCE, valor, fechamento, replay, concorrência, locks, exceções, segregação e revisão adversarial. Nenhuma migration foi aplicada.
