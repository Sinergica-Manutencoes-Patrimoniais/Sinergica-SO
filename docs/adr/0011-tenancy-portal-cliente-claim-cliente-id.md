---
name: adr-0011-tenancy-portal-cliente-claim-cliente-id
description: ADR — isolamento multi-tenant do Portal do Cliente via claim JWT cliente_id + RLS por-linha, não subquery de vínculo.
alwaysApply: false
---

# ADR-0011 — Isolamento do Portal do Cliente por claim `cliente_id`

> Status: aceito · Data: 2026-07-20 · Contexto: E09-S01 (fundação do Portal do Cliente)
> Substitui/estende: ADR-0003 (RBAC via claim JWT em `config.usuarios`).

## Contexto
O Portal do Cliente expõe dados de um condomínio a um usuário externo (`cliente-sindico`). Hoje as
RLS de `pcm.*` gateiam por **módulo** (`user_modulos->>'pcm'`), não por **propriedade da linha** —
qualquer papel com o módulo vê **todos** os clientes. Não existe vínculo usuário↔`pcm.clientes` nem
filtro por linha. Precisamos garantir que um síndico só alcance o **próprio** condomínio, com a
garantia no banco (não no frontend), porque o cliente é um ator externo e não-confiável.

## Decisão
1. **Vínculo 1:1** em nova tabela `config.usuario_cliente` (`user_id` UNIQUE ↔ `cliente_id`), RLS
   FORCE, escrita só por `service_role`/RPC de provisionamento.
2. **Claim `cliente_id` no JWT** — estender `config.custom_access_token_hook` para injetar
   `cliente_id` no token quando `user_role='cliente-sindico'` (lido do vínculo). Mesmo mecanismo do
   claim `user_modulos` (ADR-0003).
3. **RLS por-linha via claim** — as policies de leitura das tabelas expostas ao portal ganham o ramo:
   `... OR (auth.jwt()->>'user_role' = 'cliente-sindico'
            AND <coluna cliente> = (auth.jwt()->>'cliente_id')::uuid)`.
   Ler o claim (não subconsultar o vínculo por linha) é O(1) e consistente com o padrão vigente.

## Alternativas consideradas
- **Subquery do vínculo em cada policy** (`cliente_id IN (SELECT ... WHERE user_id = auth.uid())`) —
  correto mas custo por-linha e mais fácil de errar; descartado em favor do claim.
- **Confiar no frontend/shell isolada** — inaceitável para ator externo; a shell isolada e o futuro
  deploy separado são defesa-em-profundidade, **não** o controle primário.

## Consequências
- O hook vira ponto crítico: bug nele pode vazar `cliente_id` errado → pgTAP obrigatório provando
  isolamento (síndico X só lê linhas de X; sem claim → 0 linhas).
- Toda tabela nova exposta ao portal (chamados, notas de OS, documentos) deve incluir o ramo de RLS
  por `cliente_id` desde a migration.
- Trocar o vínculo de um usuário só tem efeito após novo token (refresh) — aceitável (provisionamento
  é raro).
- Mantém um único build/deploy na fase 1; o deploy separado (E09-S11) é reforço posterior, não
  substitui esta RLS.
