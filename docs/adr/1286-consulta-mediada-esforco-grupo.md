# ADR 1286 — Consulta mediada de esforço por Grupo

## Contexto

A tela da ocorrência chama diretamente um cálculo privado de esforço de Grupo, sem privilégio de execução para usuários autenticados. O cálculo depende de quantidade aprovada e tempo por unidade fotografado; ele não representa reserva ou execução.

## Decisão

Criar entrada aditiva autenticada, com identidade explícita, capacidade `plano.gerir`, gate de esforço e validação da identidade devolvida pelo cálculo existente. A entrada mantém a autorização e a trava compartilhada do gate durante a consulta; não amplia acesso direto ao núcleo. A tela opta pela entrada mediada por flag própria, desligada por padrão, e confirma a sessão em torno da consulta.

## Compatibilidade e retorno

O contrato anterior e as fontes parciais de capacidade permanecem inalterados. Aplicar a migration antes de habilitar a flag; para retornar, desligá-la. Sem modificar dados nem reservar capacidade. Provar autorização/revogação, concorrência com fechamento do gate, fontes, arredondamento, limites, RLS e revisão adversarial antes da liberação.
