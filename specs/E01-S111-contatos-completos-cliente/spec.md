---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Contatos completos do cliente (nome, email, telefone, função, preferência)

> **Fonte da verdade.** Status: rascunho
> Origem: feedback do Lucas testando localmente (2026-07-29). Item 6. **Estende E01-S103**
> (Responsável pelo cliente) — mesmo conceito, campos mais completos.

## Contexto de código
- E01-S103 já criou `pcm.cliente_responsaveis` (`cliente_id`, `nome`, `papel`, `contato`) + painel
  editável na aba Resumo da Visão 360. `papel` já cobre "Função"; `contato` hoje é 1 campo texto
  livre (telefone OU email misturados).
- `PainelContatos` (aba Comunicação/Resumo) é **read-only**, mostra só `contacts` sincronizado do
  Auvo — não é onde isso deveria ser editado (ver E02-S24/S26: já documentado que é distinto).

## Resumo
`pcm.cliente_responsaveis` ganha `email` e `telefone` como campos separados (em vez de `contato`
único) + `preferencia_contato` (ex.: "WhatsApp", "Ligação", "E-mail"). UI de edição (já existe,
E01-S103) ganha os campos novos.

## Critérios de aceite

### AC-1: Campos separados
- **Dado** o cadastro de um responsável/contato do cliente
- **Quando** o operador preenche
- **Então** existem campos distintos para nome, email, telefone, função (já era `papel`) e
  preferência de contato — nenhum campo obrigatório além do nome (mesma regra de E01-S103).

### AC-2: Preferência de contato é um valor de lista curta
- **Dado** o campo preferência de contato
- **Quando** o operador escolhe
- **Então** as opções são um conjunto fechado (WhatsApp, Ligação, E-mail, Outro) — evita texto livre
  divergente pra um dado que vai virar filtro/uso futuro (ex.: Zé saber como contatar).

### AC-3: Migração de dado existente
- **Dado** registros já criados em E01-S103 com `contato` livre
- **Quando** a migration roda
- **Então** o valor de `contato` é preservado em `telefone` **ou** `email` (sem parsing automático
  arriscado) — decisão simples: joga tudo que já existia pra `telefone` (campo texto, sem validação
  de formato), operador ajusta manualmente depois se for email.

## Casos de borda e erros
- Nem email nem telefone preenchidos → permitido (o nome sozinho já tem valor, ex.: "sabe quem é
  mas ainda não tem contato direto").
- Email em formato inválido → validação simples (contém "@"), não bloqueia salvar (best-effort).

## Fora de escopo
- Unificar com `PainelContatos` (Auvo, read-only) — continuam fontes distintas.
- Validação forte de telefone (DDI/DDD) — texto livre.

## Rastreabilidade
- Código: migration de E01-S103 (`0154`), `domain/cliente-responsaveis.ts`,
  `application/cliente-responsaveis*.ts`, `infrastructure/supabase-cliente-responsaveis-adapter.ts`,
  painel em `VisaoClientePage.tsx`.
- Estende: E01-S103.
- ADRs relacionados: —
