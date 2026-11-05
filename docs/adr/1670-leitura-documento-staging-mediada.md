---
name: adr-1670-leitura-documento-staging-mediada
description: Decisão de mediação de leitura para estrutura técnica.
alwaysApply: false
---

# ADR-1670 — Leitura mediada de documento aceito de levantamento

## Contexto

A interface solicita PDF aceito, mas a função privada que resolve o objeto teve EXECUTE revogado de usuários; a Edge anterior falha sem mediação. O caminho do Storage é informação interna.

## Decisão

Criar gate fechado por padrão. Uma RPC autenticada lista somente os campos do núcleo privado, sob a mesma trava e gates. Outra RPC autenticada bloqueia as linhas da associação, documento e objeto; após verificar ator atual, trava compartilhada de autorização, gates e o resolvedor privado existente, devolve apenas identificadores e data do objeto autorizado, sem caminho. Uma RPC acessível apenas ao serviço localiza objeto, documento e versão de metadados, repetindo as verificações de entidade, Cliente, aceitação, inadequação e bucket privado. A Edge verifica autorização e sessão antes e depois da leitura, compara a identidade autorizada ao resultado do serviço e limita bytes. Não concede EXECUTE no resolvedor privado a usuários.

## Limites

As operações de banco e Storage não são uma transação única: metadados iguais não provam que bytes não foram substituídos entre verificações. O PDF é fornecido como download restrito, sem alegar autenticidade ou segurança de seu conteúdo. A ativação depende de revisão, testes integrados de permissão/concorrência e avaliação do ambiente; sem deploy ou alteração de dados reais nesta etapa. Reversão operacional: manter gate fechado e desligar flag da Edge.
