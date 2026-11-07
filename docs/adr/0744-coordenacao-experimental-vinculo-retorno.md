---
name: "docs-adr-0744-coordenacao-experimental-vinculo-retorno-md"
description: "Documento Sinérgica SO: ADR-0744 — Coordenação experimental do vínculo Grupo e retorno"
alwaysApply: false
---

# ADR-0744 — Coordenação experimental do vínculo Grupo e retorno

## Status

Experimental, gate próprio desligado. Não libera Grupo para execução nem declara segurança global.

## Decisão

Nas duas guardas de INSERT já existentes, tentar obter um advisory lock transacional por UUID de OS, antes de consultar a outra relação. Usar `pg_try_advisory_xact_lock`, com falha `55P03` e retry pelo chamador, sem esperar segurando locks anteriores. Rejeitar isolamentos diferentes de READ COMMITTED enquanto sua semântica não estiver demonstrada. Depois do lock, executar novamente as mesmas verificações de origem e retorno; não se aceita sucesso parcial.

O gate da coordenação inicia desligado e não substitui o gate de associação ou a guarda 0903. Com gate desligado, preservar o comportamento das guardas anteriores. Não conceder acesso direto às tabelas, não chamar Auvo nem modificar dados históricos.

## Limites e validação

O protocolo protege apenas a disputa entre INSERT das relações contempladas pelos dois triggers; não afirma cobertura de todos os escritores, locks de OS/retorno, replay ou revisões. Antes de qualquer liberação, provar concorrência em duas sessões em ambas as ordens, retry após commit, recusa em REPEATABLE READ e SERIALIZABLE, escopo, permissão, rollback, visibilidade de dados sob READ COMMITTED e cobertura dos demais escritores. A reprodução anterior insere retorno como owner e não testa a RPC 0402 integralmente. Permanece necessária revisão adversarial e homologação em ambiente autorizado.

Reversão exige restaurar as funções anteriores de 0903 e 0960 após conferir dependências; não apagar vínculos nem habilitar gate como parte da reversão.
