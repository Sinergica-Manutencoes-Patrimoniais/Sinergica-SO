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
- RLS: `cliente-sindico` só vê dados do seu próprio condomínio. **Mecanismo definido em E09-S01/ADR-0011:**
  vínculo 1:1 `config.usuario_cliente` + claim JWT `cliente_id`; policies leem o claim
  (`<col cliente> = (auth.jwt()->>'cliente_id')::uuid`), não subquery por linha.
- Dados sensíveis (custo, rentabilidade) **nunca** expostos.
- **Financeiro ao síndico (regra fixada, resolve divergência com `ESCOPO-MESTRE §6.9`):** o portal
  PODE expor **fatura, vencimento, status de pagamento e 2ª via** via views dedicadas ao
  `cliente-sindico` (E09-S10) — mas NUNCA custo/margem/rentabilidade. E09-S10 depende do módulo
  Financeiro (E04) ser construído.
- Sem acesso a backlog interno (priorização é operacional).

> **Épico especificado em 2026-07-20:** ver `docs/epics/ROADMAP.md` §E09 (11 stories, S01 fundação
> design-first). Além das funcionalidades acima, o escopo aprovado inclui: interação nas OS com
> notas/anexos (E09-S05), central de documentos (E09-S06), cronograma+conformidade (E09-S07),
> notificações+satisfação (E09-S08), aprovação de orçamento (E09-S09, destrava E01-S14), e deploy
> separado do portal (E09-S11).

## Autenticação
- Login por email/senha (Supabase Auth) — convite enviado pelo escritório.
- Sem acesso ao dashboard principal (`supervisor`/`superadmin`).

## Interface
- Design simplificado, orientado ao síndico leigo.
- Mobile-first (síndico usa principalmente celular).
- Relatórios: botão de download (signed URL com expiração de 24h).
