---
name: "docs-adr-0888-s169-leitura-snapshot-exportacao-md"
description: "Documento Sinérgica SO: ADR-0888 — Leitura paginada do snapshot para exportação"
alwaysApply: false
---

# ADR-0888 — Leitura paginada do snapshot para exportação

Data: 2026-10-30 · Status: preparação; gate fechado, sem homologação.

## Contexto

A exportação experimental recebe Rotinas vivas da interface. A comparação de quantidade e vigência com metadados não demonstra igualdade com a fotografia aprovada; nomes de Plano e alvos também podem ter mudado. A leitura dos metadados existente está revogada e não resolve essa lacuna.

## Decisão

Preparar RPC aditiva paginada, com gate próprio inicialmente fechado, sem alterar a exportação antiga nem dados. A leitura exige sessão, capacidade `plano.gerir` e vínculo Cliente/Plano/versão aprovada. Usa trava compartilhada de autorização, trava do gate e isolamento READ COMMITTED. A resposta expõe apenas campos de exportação da fotografia aprovada, não o JSON integral, questionários, custos ou dados pessoais. Cada página informa contagem, próxima posição e hash da fotografia para detectar alterações entre páginas; não interpreta data-base como execução. Snapshot ausente ou estruturalmente inválido falha fechado, sem inventar dados.

Consumidor futuro deve validar tipos, identidade e duplicidades em todas as páginas, comparar hash e metadados, repetir conferência após gerar o arquivo e não tratar hash como prova criptográfica de autenticidade. Filtros, cronograma, capacidade, auditoria da emissão e concorrência dos autores do snapshot não são resolvidos aqui. Não vincular a UI até existir teste integrado e revisão de autorização e consistência; gates continuam fechados.

## Compatibilidade e retorno

RPC e gate são aditivos, sem alterar ACL ou consumidores legados. Rollout coordenado só após testes de isolamento, revogação, fechamento de gate e conteúdo completo. Reverter consumidor primeiro e manter gate fechado; nenhuma exclusão de dados ou alteração de migração anterior. A proteção de autorização depende de todos os escritores relevantes cooperarem com a trava compartilhada; conferir isso e os privilégios oficiais em revisão adversarial antes de ativar.
