---
name: "docs-adr-1532-serializacao-materializacao-preventiva-legada-md"
description: "Documento Sinérgica SO: ADR-1532 — Serializar geração e edição de preventivas legadas"
alwaysApply: false
---

# ADR-1532 — Serializar geração e edição de preventivas legadas

A geração de ocorrências lia a regra do Plano sem travar a linha. Uma edição concorrente poderia validar ausência de ocorrências e alterar a regra enquanto a geração inseria ciclos calculados pela regra anterior.

A geração existente passa a obter `FOR UPDATE` na linha antes de ler a regra. A edição já toma a mesma trava e a validação existente recusa alterações estruturais após a primeira ocorrência. O bloqueio dura até o fim da transação e preserva assinatura, ACL, histórico, códigos e idempotência; não se cria rota ou gate. Gerações mediadas por SSO que inserem ocorrências legadas já travam essa linha.

A migration verifica a definição antes de substituir somente a leitura; se a função instalada divergir, falha sem alterá-la. A proteção 1045 permanece. É necessário testar concorrência em ambas as ordens, rollback e isolamento suportado, além de revisão adversarial antes da homologação. Escritas privilegiadas diretas fora dos comandos canônicos não são cobertas; não comprova exclusividade global de PMOC ou fontes externas. Rollback: restaurar a definição anterior da função 0224, mantendo dados.
