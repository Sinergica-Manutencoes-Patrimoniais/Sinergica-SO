---
name: blueprint-area-cliente
description: Requirements do módulo Área do Cliente (portal do síndico). Puxe ao planejar specs do portal.
alwaysApply: false
---

# Blueprint — Área do Cliente (Portal do Síndico)

> Schema Postgres: (views restritas de `pcm`) · Feature: `apps/web/src/features/area-cliente/`

## Problema
Síndicos não tinham acesso ao histórico de manutenções além do WhatsApp. Transparência e
prestação de contas eram feitas por PDF enviado manualmente.

## Funcionalidades

### Para o síndico (read-only exceto abertura de chamado)
- **Painel do condomínio**: resumo de OS abertas, backlog, preventivo do mês.
- **Histórico de OS**: lista com filtros (status, período, categoria).
- **Relatórios**: lista e download de relatórios mensais e laudos em PDF.
- **Abrir chamado**: formulário simplificado (alternativa ao Zé para quem prefere web).

## Regras de acesso
- RLS: `cliente-sindico` só vê dados do seu próprio condomínio (`WHERE client_id = auth.uid()` via tabela de vínculo).
- Dados sensíveis (custo, rentabilidade) não expostos — só SLA e status operacional.
- Sem acesso a backlog interno (priorização é operacional).

## Autenticação
- Login por email/senha (Supabase Auth) — convite enviado pelo escritório.
- Sem acesso ao dashboard principal (`supervisor`/`superadmin`).

## Interface
- Design simplificado, orientado ao síndico leigo.
- Mobile-first (síndico usa principalmente celular).
- Relatórios: botão de download (signed URL com expiração de 24h).
