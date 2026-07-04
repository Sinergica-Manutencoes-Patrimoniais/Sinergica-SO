---
name: spec-E01-S19-inspecoes-laudos-spda
description: Contrato das abas de Inspeções e Laudos SPDA no PCM SO.
alwaysApply: false
story: E01-S19
epic: E01
title: Inspeções e Laudos SPDA no PCM SO
owner: "@pm"
status: approved
tier: arquitetural
created_at: 2026-07-04
---

# E01-S19 — Inspeções e Laudos SPDA no PCM SO

## Objetivo

Trazer para o Sinérgica SO as abas operacionais de **Inspeções** e **Laudos SPDA** que existem no
PCM antigo, usando o padrão visual e de permissões do SO e criando persistência própria no schema
`pcm`.

## Escopo

- Criar tabelas para inspeções, itens de inspeção, laudos SPDA e pontos de medição SPDA.
- Expor duas abas navegáveis no módulo PCM: `Inspeções` e `Laudo SPDA`.
- Permitir listar, criar e detalhar inspeções por cliente.
- Permitir adicionar itens de inspeção com sistema, localização, resultado, severidade e recomendação.
- Permitir listar, criar e detalhar laudos SPDA por cliente.
- Permitir adicionar pontos de medição SPDA com resistência, conformidade e URL/referência de foto.
- Aplicar o mesmo gate do módulo PCM:
  - `leitura`: pode visualizar.
  - `escrita`: pode criar/alterar.

## Fora de Escopo

- Upload/Storage de fotos nesta entrega.
- Geração de PDF assinável.
- Cálculo NBR completo com todas as tabelas do PCM antigo.
- Criação automática de backlog/OS a partir de inconformidades.
- Consumo direto de endpoints Auvo para SPDA/inspeções, pois esta vertical slice não precisa de dado
  externo para funcionar.

## Critérios de Aceite

- **AC-1:** Usuário com leitura PCM consegue abrir a aba `Inspeções` e ver inspeções cadastradas.
- **AC-2:** Usuário com escrita PCM consegue criar inspeção vinculada a um cliente.
- **AC-3:** Usuário com escrita PCM consegue adicionar item de inspeção e o painel recalcula totais.
- **AC-4:** Usuário com leitura PCM consegue abrir a aba `Laudo SPDA` e ver laudos cadastrados.
- **AC-5:** Usuário com escrita PCM consegue criar laudo SPDA vinculado a um cliente.
- **AC-6:** Usuário com escrita PCM consegue adicionar ponto de medição SPDA com resistência e URL de foto.
- **AC-7:** Usuário sem escrita PCM não vê comandos de criação/edição.
- **AC-8:** A persistência usa RLS compatível com `user_modulos.pcm`.
