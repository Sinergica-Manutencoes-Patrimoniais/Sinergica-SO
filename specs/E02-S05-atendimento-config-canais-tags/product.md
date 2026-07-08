---
name: product
description: PRD-lite — Config de Atendimento (canal por condomínio + catálogo de tags), tier Pequeno.
alwaysApply: false
---

# Product — Config: Canais + Tags

> **Tier:** Pequeno · **Status:** aprovado · **Dono:** Claude (sessão Lucas)
> Épica: E02 — Atendimento · Zé. Depende de `E02-S01` mergeada (schema `atendimento.conversas`).

## Problema
Hoje `atendimento.config_ze` (modo/`group_jid`/`bot_jid` por condomínio) só é editável via SQL
direto no Supabase Studio — não existe tela. E `atendimento.conversas.tags` (coluna `text[]`
existente desde `E02-S01`) não tem nenhuma UI para atribuir ou gerenciar tags; sem um catálogo, cada
colaborador digitaria a tag livremente e "urgente"/"Urgente"/"URGENTE" viram 3 tags diferentes.

## Para quem
Fabrício e colaboradores do escritório com permissão de leitura/escrita no módulo `atendimento`.

## Decisões de escopo (resolvidas nesta story, @pm)

1. **Tags: catálogo próprio, não string livre.** Reaproveita o padrão já usado em
   `pcm.segmentos`/`pcm.palavras_chave` (`catalogos-simples`): tabela com `nome`+`ativo`, sem cor
   (não há requisito que justifique diferenciação visual por cor agora — YAGNI). Um catálogo evita
   duplicidade por digitação livre e permite desativar uma tag sem apagar o histórico de conversas
   que já a usam (`conversas.tags` continua sendo o `text[]` de nomes, sem FK — mesmo motivo de
   `cliente_grupos.clientes_auvo_ids` em `E01-S27`: o filtro por tag não precisa de join, só
   precisa que o nome exista no catálogo no momento da atribuição).
2. **Templates: fora de escopo desta story.** O "templates" do título original do ROADMAP
   (herdado do plano da épica) pressupõe o conceito de mensagens pré-aprovadas da API oficial do
   WhatsApp Business (Meta) — não se aplica ao Evolution API (WhatsApp não-oficial) usado hoje.
   Templates voltam a fazer sentido se/quando `E02-S04` (Instagram/Messenger via Meta Graph API)
   entrar; até lá, ficam como não-objetivo aqui. Story renomeada para "Config: Canais + Tags".
3. **Canal:** só WhatsApp/Evolution existe hoje — o form edita `config_ze` (já existente, sem
   migration de schema nova para o canal). Sem tabela de "canais" plural — não há um segundo canal
   real para justificar essa generalização agora (mesma disciplina anti-abstração-prematura já
   aplicada no projeto).

## Resultado esperado / métrica de sucesso
- Métrica: nº de edições de `config_ze`/tags feitas via SQL manual no Supabase Studio depois desta
  story (alvo: zero — tudo pela tela).
- Alvo: colaborador com permissão de escrita cria/edita a config de Zé de um condomínio e
  gerencia o catálogo de tags, sem depender de acesso direto ao banco.

## Goals
- Tela "Config" dentro do módulo Atendimento (nova aba `AtendimentoView="config"`), com 2 seções:
  Canal (form sobre `config_ze` por cliente) e Tags (CRUD simples, padrão `catalogos-simples`).
- Reaproveitar o campo `conversas.tags` já existente para exibir/filtrar por tag no Inbox
  (`E02-S02`) — fora de escopo mexer no Inbox aqui; só o catálogo é novo.

## Non-goals
- Editar tags diretamente na tela do Inbox (isso fica pra quando o catálogo existir — pode virar
  ajuste rápido de UI depois, sem tocar em schema).
- Templates de mensagem aprovados (ver decisão 2 acima).
- Canais além de WhatsApp (`E02-S04`).
- IA/personas (`E02-S06`).

## Riscos / premissas
- Premissa: `E02-S01` mergeada (para a coluna `conversas.tags` existir).
- Risco: sem Deno CLI/Docker neste ambiente, sem verificação automática de Edge Function além de
  revisão manual — mesma ressalva de toda a integração desde `E01-S09`. Esta story não deve
  precisar de Edge Function nova (CRUD direto via RLS, mesmo padrão de `catalogos-simples`).
