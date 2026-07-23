---
name: spec-E01-S88-chamados-entidade
description: Contrato — Chamado (CH) como entidade própria (pcm.chamados), tela de criação, geração de OS/backlog, cancelamento com justificativa+anexo, rename Ticket→Chamado.
alwaysApply: true
tier: arquitetural
---

# Spec — Chamados (CH)

> **Fonte da verdade.** Status: aprovado (após `design.md`)
> Origem: reunião Lucas × Fabrício (2026-07-16), item 3.1. Depende de `./design.md`.

## Resumo
O SO passa a ter **Chamado (CH-XXXX)** como entidade própria (`pcm.chamados`): o registro rastreável
de tudo que ainda não é OS (solicitações, itens de inspeção). Tem tela de criação interna, pode gerar
OS ou ir ao backlog, e tem fluxo de cancelamento com justificativa + anexo. "Ticket" sai da UI.

## Critérios de aceite

### AC-1: Entidade Chamado com numeração única
- **Dado** a criação de um Chamado
- **Quando** é persistido
- **Então** recebe um `CH-XXXX` único e sequencial (sem race — via sequence, não `count()`), com
  origem (`manual`/`cliente_portal`/`whatsapp`/`inspecao`), cliente, título, descrição, status.

### AC-2: Tela de criação interna
- **Dado** um usuário com permissão de escrita
- **Quando** cria um Chamado pela tela
- **Então** informa os campos pertinentes e o Chamado aparece na lista de Chamados, rastreável.

### AC-3: Chamado origina OS ou backlog
- **Dado** um Chamado aberto
- **Quando** o usuário decide o destino
- **Então** pode gerar uma **OS** (vínculo Chamado↔OS) ou enviá-lo ao **backlog** (E01-S83),
  mantendo o rastreio à origem.

### AC-4: Cancelamento com justificativa + anexo
- **Dado** um Chamado
- **Quando** o usuário cancela
- **Então** justificativa (texto) é **obrigatória** e é possível anexar arquivo (ex.: print de
  WhatsApp); o cancelamento fica registrado append-only (quem/quando/por quê). Sem justificativa,
  não cancela.

### AC-5: Rename Ticket → Chamado
- **Dado** a UI operacional do PCM
- **Quando** o usuário navega
- **Então** lê "Chamado" (não "Ticket"); a página de Ticket sai da navegação operacional;
  `docs/glossary.md` reflete o termo. `pcm.tickets` (dado Auvo histórico) não é apagada.

## Casos de borda e erros
- Cancelar Chamado já virado OS → bloquear/definir regra (cancela a OS, não o Chamado) — decidir no
  domínio e cobrir por teste.
- Anexo grande/tipo inválido → validar antes de subir ao Storage.
- Numeração concorrente (2 criações simultâneas) → sequence garante unicidade.

## Fora de escopo (vinculante)
- Tela do **Portal do Cliente** para abrir Chamado (modelo pronto, tela é E09/futuro).
- Migrar dados históricos de `pcm.tickets` para `pcm.chamados`.
- Histórico de WhatsApp anexado ao Chamado (é E01-S89).

## Rastreabilidade
- Design: `./design.md`
- Migration: `pcm.chamados` (RLS FORCE, sequence `CH`) + eventos append-only + Storage p/ anexo
- Domínio/application/adapter em `apps/web/src/features/pcm/`
- UI: nova `ChamadosPage` (substitui `TicketsPage` na navegação)
- Glossário: `docs/glossary.md` (Chamado)
