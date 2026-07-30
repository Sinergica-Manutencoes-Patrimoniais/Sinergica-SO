---
name: product
description: PRD-lite da feature (por quê e para quem). Puxe ao abrir feature pequena/arquitetural.
alwaysApply: false
---

# Product — Agente entrevistador de cadastro de cliente/estrutura

> **Tier:** arquitetural · **Status:** rascunho · **Dono:** Lucas / @prompt-engineer / @architect

## Problema
Cadastrar um condomínio novo (contato, CNPJ e, principalmente, a **estrutura de locais** —
torre/andar/sala, quantidade de hidrantes/extintores por andar, etc.) é trabalhoso e manual.
O Fabrício quer um **agente conversacional** que **entrevista** o colaborador que faz a inspeção
(ou ele mesmo) sobre o prédio e monta a árvore de estrutura e os dados cadastrais a partir das
respostas — como um copiloto que "vai montando a estrutura desse condomínio" durante a conversa.

## Para quem
Operação da Sinérgica no onboarding/atualização de um cliente: o colaborador que visita o prédio e
o próprio Fabrício. Frequência: a cada novo cliente e em atualizações de estrutura.

## Segundo ponto de entrada: "Editar cliente com IA" (Lucas, 2026-07-29, item 7)
Testando localmente, o Lucas esperava encontrar um botão de edição via IA ao lado do "Editar"
manual no cadastro do cliente — **é o mesmo motor desta story**, só que entrando por "editar um
cliente que já existe" em vez de "cadastrar um cliente novo". Mesmo agente, mesmo fluxo
(pergunta/responde → monta proposta → **sempre dry-run**, mostra o que vai mudar → só aplica após
confirmar), diferença é só o ponto de entrada:
- **Onboarding** (fluxo original): entrevista do zero, sem dado prévio.
- **Edição**: botão "Editar com IA" ao lado do "Editar" manual em `PainelCadastroAuvo`/
  `ClienteFormModal` (`VisaoClientePage.tsx`) abre o mesmo chat, já com o cadastro atual como
  contexto — o operador pode pedir qualquer ajuste (dados, estrutura) em linguagem natural, o
  agente sempre responde em modo dry-run (apresenta o que vai mudar) antes de gravar.

## Resultado esperado / métrica de sucesso
- Métrica: tempo/esforço para cadastrar estrutura completa de um cliente.
- Baseline: cadastro manual campo a campo → Alvo: entrevista guiada que pré-preenche o cadastro,
  com **confirmação humana** antes de gravar.

## Decisões de negócio travadas (reunião 2026-07-27)
- Perguntas da entrevista são **configuráveis** (quais perguntas, para qual contexto).
- Saída da entrevista é uma **confirmação apresentada ao entrevistado**; **só após ele confirmar**
  os cadastros são efetivados (contato, CNPJ, estrutura de locais…).
- A estrutura de local é uma **árvore** (ex.: torre → andar → sala), até ~3 níveis, com padrão
  configurável por perfil de prédio (ex.: "todo prédio X tem 2 hidrantes/andar") como base.
- O cadastro manual **continua existindo** — o agente acelera, não substitui a capacidade de editar
  na mão (Lucas: "mantém esse na mão, porque é importante conseguir manipular").

## Goals
- Motor de entrevista com **roteiro de perguntas configurável**.
- Geração de proposta de cadastro (contato/CNPJ/estrutura) a partir das respostas.
- Tela de **confirmação** antes de gravar; gravação só após o "confirma".
- Escrita nos cadastros existentes (cliente, estrutura de locais/ativos).

## Non-goals
- Substituir o cadastro manual (ele permanece).
- Cadastrar equipamentos que a Sinérgica não gerencia (ex.: hidrante que o Fabrício não cataloga).
- Portal/acesso externo do cliente (Área do Cliente foi descartada — item 14).

## Riscos / premissas
- **Risco:** o agente gravar dados errados sem revisão → mitigado pela confirmação obrigatória.
- **Risco:** padrão configurável mal definido leva a sugestões ruins → padrão é opcional/edital.
- **Premissa:** a estrutura de local (árvore até 3 níveis) já existe ou será estendida (ADR-0009
  hierarquia de localização de ativos).
