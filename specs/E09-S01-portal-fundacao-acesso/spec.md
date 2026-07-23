---
name: spec-E09-S01-portal-fundacao-acesso
description: Contrato — fundação do Portal do Cliente: vínculo usuário↔cliente 1:1, claim cliente_id, RLS por-linha, shell isolada por papel, "Criar acesso" na Visão 360.
alwaysApply: true
tier: arquitetural
---

# Spec — Fundação de acesso & isolamento do Portal do Cliente

> **Fonte da verdade.** Status: aprovado (após `design.md` + ADR-0011). Segurança-crítica (ator externo).
> Origem: pedido do Lucas (2026-07-20) — Portal do Cliente com auth local, acesso criado pelo Fabrício
> de dentro da tela do cliente. Abre o épico E09.

## Resumo
O `cliente-sindico` deixa de ser um papel vazio: ganha vínculo 1:1 com um condomínio, isolamento de
dado por-linha via claim `cliente_id` (garantido no banco), uma shell de portal isolada da UI do SO,
e provisionamento pelo botão "Criar acesso" na Visão 360.

## Critérios de aceite

### AC-1: Vínculo usuário↔cliente 1:1
- **Dado** o provisionamento de um síndico
- **Quando** o acesso é criado
- **Então** existe uma linha em `config.usuario_cliente` (`user_id` UNIQUE ↔ `cliente_id`); um mesmo
  login não pode vincular a dois clientes.

### AC-2: Claim `cliente_id` no token
- **Dado** um `cliente-sindico` autenticado
- **Quando** o token é emitido/renovado
- **Então** o JWT carrega `cliente_id` (do vínculo), além de `user_role='cliente-sindico'`. Usuário
  sem vínculo não recebe `cliente_id`.

### AC-3: Isolamento por-linha (RLS) — o teste que mais importa
- **Dado** dois clientes A e B e um síndico vinculado a A
- **Quando** o síndico A consulta `pcm.clientes` (e a base do painel)
- **Então** vê **somente** as linhas do cliente A; nunca as de B. Síndico sem `cliente_id` → **zero**
  linhas. Garantido por RLS FORCE lendo o claim (não pelo frontend). **pgTAP obrigatório.**

### AC-4: Resolver concede portal ao síndico
- **Dado** um `cliente-sindico`
- **Quando** as permissões são resolvidas
- **Então** recebe `area-cliente: leitura` (não mais `{}`); os módulos internos do SO permanecem
  negados.

### AC-5: Shell isolada por papel
- **Dado** um `cliente-sindico` logado
- **Quando** entra no app
- **Então** cai numa `PortalShell` dedicada (feature `area-cliente/`) e **nunca** vê a `HomePage`/
  sidebar/abas do SO interno; um papel interno nunca cai na PortalShell.

### AC-6: "Criar acesso" pela Visão 360
- **Dado** um superadmin/supervisor na Visão 360 de um cliente
- **Quando** clica "Criar acesso" e informa email/senha do síndico
- **Então** um Auth user `cliente-sindico` é criado (auth local) e vinculado 1:1 àquele cliente numa
  operação atômica (rollback em falha); a senha nunca é logada. Gate: só superadmin/supervisor.

## Casos de borda e erros
- Criar acesso para cliente que já tem síndico vinculado → bloquear/definir regra (1:1) e cobrir.
- Síndico com vínculo removido → perde acesso ao dado no próximo token (RLS retorna 0 linhas).
- Falha ao gravar vínculo após criar Auth user → rollback deleta o Auth user (padrão existente).

## Fora de escopo (vinculante)
- Multi-unidade (síndico com N condomínios) — vínculo é 1:1 neste MVP.
- Telas de conteúdo do portal (painel/chamados/OS/etc.) — são E09-S02+.
- Deploy separado — é E09-S11 (aqui a shell é interna, mesma app).
- Exposição de dado financeiro — E09-S10 (bloqueado por E04).

## Rastreabilidade
- Design: `./design.md` · ADR-0011 (tenancy) · ADR-0003 (RBAC por claim)
- Migration: `config.usuario_cliente` + alteração de `config.custom_access_token_hook` +
  `config.resolver_permissoes_modulo` + policies por-linha em `pcm.clientes` (+ base do painel) + pgTAP
- Provisionamento: `supabase/functions/config-gerenciar-usuario/index.ts` (estendida),
  `apps/web/src/features/pcm/pages/VisaoClientePage.tsx` (botão "Criar acesso")
- Shell: `apps/web/src/app/App.tsx` (roteamento por papel), nova `apps/web/src/features/area-cliente/`
  (`PortalShell`)
- Auth front: `auth-context.tsx`, `permissoes-context.tsx`, `permissao.ts`
