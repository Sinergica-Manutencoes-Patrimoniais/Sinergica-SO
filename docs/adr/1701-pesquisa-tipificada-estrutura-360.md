---
name: adr-1701
description: Consulta paginada e tipada da estrutura na Visão 360, sem fundir entidades.
alwaysApply: false
---

# ADR-1701 — Pesquisa tipificada da estrutura

Status: aceita para implementação, 25/11/2026. Story E01-S190, AC-9 e AC-10.

## Contexto
A pesquisa existente só filtra Área/Local. Carregar todos os cadastros no navegador para ampliar
a pesquisa limita o alcance às páginas baixadas e exige leituras separadas para códigos de Grupo.

## Decisão
Adicionar RPC de leitura paginada por Cliente, reunindo resultados tipados de Área, Local,
Sistema, Equipamento, Componente e Grupo Quantitativo. Tabelas, identidades e regras permanecem.
Nome/código/TAG são pesquisados no servidor; cursor é chave tipo:id. Vínculos físicos
(Área/Local) e funcionais (Sistema/pai de Equipamento) permanecem campos distintos.

Security definer permite ler o código atual privado dos Grupos sem dar acesso à tabela.
Exige identidade autenticada, permissão PCM relida ao vivo e concessão cadastro.ler ou
cadastro.gerir no Cliente. Sem SQL dinâmico, tabelas genéricas ou escrita.
Somente authenticated recebe EXECUTE; parâmetros e limite validados. Detalhes continuam
usando os contratos de cada entidade. Revogação, outro Cliente, paginação e tipos têm prova pgTAP.

## Consequências e retorno
Migration aditiva, sem tabela, flag ou gate novo. Deploy do servidor precede front.
Voltar front restaura jornada anterior. Reverso: revogar EXECUTE e remover apenas
a função depois de retirar consumidores. Nenhum dado ou histórico de negócio é modificado.

