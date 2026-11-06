---
name: "docs-adr-0890-s169-ocorrencias-cronograma-md"
description: "Documento Sinérgica SO: ADR-0890 — Fonte parcial de ocorrências para cronograma"
alwaysApply: false
---

# ADR-0890 — Fonte parcial de ocorrências para cronograma

Data: 2026-10-30 · Status: preparação, gates fechados; não homologado.

## Contexto

O compositor de cronograma distingue baseline de programação, mas ainda recebe declarações locais não verificadas. A consulta de capacidade existente retorna apenas ocorrências sem OS e portanto não cobre o cronograma completo. Ocorrências preparadas de calendário e Visita são fontes existentes, mas não provam ausência de ocorrências legadas, demanda incompleta, feriados ou execução.

## Decisão

Adicionar leitura paginada e autorizada por Cliente, Plano, versão aprovada e janela limitada a 366 dias, sobre ambas as tabelas preparadas. Reutilizar 1074 para validar fotografia e travas; exigir também `visita.confirmar` e gate próprio inicialmente fechado. A ocorrência de Visita informa a data local atual, estado e revisão da Visita; uma Visita cancelada não é apresentada como programação ativa. Para ocorrência de calendário não se inventa data programada. Sempre identificar a fonte como parcial e sua cobertura como desconhecida; não deduzir conclusão de campo nem execução.

Paginar pela identidade composta tipo/ID, sem armazenar dados nem gerar tarefa. Dados e referências divergentes devem falhar fechados no consumidor; no fim da geração, reler a fonte e a fotografia, comparando conteúdo completo. Paginação entre requisições não é uma transação única: não declara fotografia operacional estável nem cobertura completa, e depende de estratégia de concorrência e reconciliação antes de liberação.

## Compatibilidade e retorno

Nova RPC e gate são aditivos, sem alterar consumidores anteriores ou tabelas existentes. Reverter consumidor primeiro e manter gate fechado; nenhum dado deve ser apagado. Antes de abrir, comprovar autorização, escopo, RLS, datas com fuso, Visitas canceladas e reprogramadas, paginação concorrente, impactos de revisão e fontes legadas; realizar revisão adversarial e testes oficiais. Não encaminhar dados ao Auvo.
