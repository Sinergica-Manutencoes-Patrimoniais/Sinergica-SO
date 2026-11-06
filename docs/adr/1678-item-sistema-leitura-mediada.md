---
name: adr-1678-item-sistema-leitura-mediada
description: Consulta por identidade para membro não presente nas páginas carregadas.
alwaysApply: false
---

# ADR-1678 — Leitura pontual de membro do Sistema

## Estado

Proposta para revisão e ensaio; não autoriza ativação ou implantação.

## Decisão

A árvore do Sistema pagina membros e itens independentemente. Para abrir um membro ausente da página de itens, uma borda recebe ator, Cliente, Sistema e item; retorna somente colunas já presentes na fonte de itens da migration 1810, após confirmar o vínculo atual e que Sistema e item pertencem ao mesmo Cliente. A ausência, inatividade ou exclusão não é interpretada como autorização para consultar outro Cliente. Não há busca por identificador sem vínculo.

A função segue as mesmas condições da 1810: gate 1809 ativo, autorização atual `cadastro.ler` ou `cadastro.gerir`, e claim PCM legado ou superadmin. A checagem de gate serializa revogações como no protocolo existente. Travas de leitura do vínculo, Sistema e item evitam misturar versões durante a consulta; conflitos falham fechados. O resultado é mínimo, nunca expõe dados de outros Clientes e não reabre gates.

## Limites e validação

A borda é SECURITY DEFINER sob os mesmos pressupostos de owner e políticas de 1810; não comprova ACL do destino ou equivalência a políticas adicionais nesse destino. Sessão é conferida antes e depois na interface; falha e revalidação ocultam dados antigos. Testar Cliente cruzado, ausência de vínculo, revogação, mudanças concorrentes, paginação e sessão antes de liberar. Não há prova de retrato persistente após o término da transação.
