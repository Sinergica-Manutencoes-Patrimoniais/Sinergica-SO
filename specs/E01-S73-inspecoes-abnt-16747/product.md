---
name: product
description: PRD — reconstrução profissional do módulo de Inspeções (ABNT NBR 16747), parametrizável por tipo, com edição completa e mídia por item. Leia antes de implementar E01-S73.
alwaysApply: false
---

# Product — Inspeções profissionais ABNT NBR 16747 (E01-S73)

> **Tier:** arquitetural · **Status:** aprovado pelo PO (Lucas, 2026-07-14) · Reconstrói a inspeção
> da E01-S19 (que é enxuta e não editável).

## Problema
A tela de inspeção atual (E01-S19) permite criar uma inspeção com 5 campos e itens com 3 campos
(resultado/severidade/foto ficam hardcoded), **não permite editar** (nenhuma camada app/UI tem
update, apesar da RLS já permitir), não tem parametrização por tipo de inspeção e não tem upload de
mídia. Para o trabalho de engenharia da Sinérgica (inspeção predial, elétrica, SPDA, hidráulica,
estrutural), isso é insuficiente — falta o rigor de um laudo profissional conforme **ABNT NBR 16747
(Inspeção Predial)**.

## Para quem
- **Inspetor/engenheiro (colaborador/supervisor com PCM escrita):** cria e edita inspeções em
  campo/escritório, registra itens com fotos/vídeos/medições, gera base para o laudo.
- **Supervisor:** cria e edita os **tipos de inspeção** e seus **checklists** (parametrização) sem
  depender de dev.

## Decisões do PO (2026-07-14) — vinculantes
1. **Reconstruir** (não estender): schema profissional novo, migra o que existe da E01-S19.
2. **Adotar Supabase Storage agora**: bucket privado com RLS para foto/vídeo/documento por item
   (primeiro uso real de Storage no repo). Mídia vinda do Auvo continua por URL.
3. **Tela de admin de templates já**: supervisor monta/edita tipos de inspeção e itens de checklist
   pela UI.

## Estrutura (ABNT NBR 16747) — 2 partes

### Parte 1 — Dados da Inspeção (cabeçalho)
Código, tipo de inspeção, cliente, edificação/local, endereço, data, horário de início e fim,
inspetor, responsável no local, status, escopo, norma técnica utilizada, ART (quando aplicável),
condições da inspeção, observações gerais, anexos.

### Parte 2 — Itens de Inspeção
Por item: categoria, sistema, elemento inspecionado, localização, identificação, resultado
(Conforme / Não Conforme / Não Aplicável), grau de risco, estado de conservação, descrição da
anomalia, medições, fotos, vídeos, documentos, recomendação, prazo para correção, responsável pela
ação corretiva, observações.

### Parametrização
Tipos de inspeção configuráveis (predial, estrutural, elétrica, SPDA, hidráulica…) com **checklists
configuráveis** — cada tipo tem um template de itens esperados. Ao criar uma inspeção de um tipo, os
itens do template já vêm pré-carregados para o inspetor preencher. Suporta gerar laudo técnico
depois (fora do escopo desta story, mas o modelo prepara).

## Resultado esperado
- Inspeção editável de ponta a ponta (cabeçalho + itens), com mídia real por item.
- Supervisor cria um tipo novo de inspeção e seu checklist sem código.
- Laudo profissional passa a ter todos os campos de engenharia que o modelo NBR 16747 pede.

## Non-goals (desta story)
- Geração automática do PDF do laudo (o modelo prepara; a geração é story futura, reusa a Edge
  Function de laudo quando existir).
- Assinatura digital do laudo.
- Migração de inspeções antigas para os campos novos além do mínimo (campos novos ficam nulos no
  histórico).
- Laudo SPDA (`pcm.laudos_spda`) — feature separada, não é reconstruída aqui (só coexiste).

## Riscos / premissas
- Storage: custo pequeno no início; bucket privado + RLS por módulo PCM (padrão do repo para dado
  sensível). Vídeo pode pesar — considerar limite de tamanho no upload.
- Reconstrução com dados em produção: a inspeção atual tem uso? Se sim, migrar os campos comuns
  (cliente/data/título/itens) para o novo schema; senão, migração trivial. Confirmar volume antes
  da migration destrutiva (o `design.md` trata a estratégia de migração).
