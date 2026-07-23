---
name: design-E09-S01-portal-fundacao-acesso
description: Design — fundação do Portal do Cliente: vínculo usuário↔cliente 1:1, claim cliente_id, RLS por-linha, shell isolada por papel, provisionamento pela Visão 360.
alwaysApply: false
---

# Design — Fundação de acesso & isolamento do Portal do Cliente

> **Tier arquitetural + segurança-crítica.** Ator externo (`cliente-sindico`). Aprovar antes de codar.
> Ver ADR-0011 (tenancy por claim `cliente_id`) e ADR-0003 (RBAC por claim). `seguranca/os-grade.md`.

## Problema
O papel `cliente-sindico` existe ponta a ponta (tipo `role.ts:5`, constraint `config.usuarios`, enum
da Edge Function `config-gerenciar-usuario`, dropdown de `UsuariosPage`, hook JWT) mas é **vazio**:
- `config.resolver_permissoes_modulo` retorna `{}` para ele (`0008:65-67`) → `user_modulos={}`.
- Nenhuma RLS de domínio o inclui; `pcm.clientes` gateia por módulo, **sem filtro por linha**.
- Não há vínculo usuário↔`pcm.clientes`, nem shell/rota isolada — todo papel renderiza a `HomePage`
  do SO.
Resultado: o síndico loga mas não tem para onde ir, e não há isolamento "só o SEU condomínio".

## Contexto atual (AS-IS)
- Auth/claims: `config.custom_access_token_hook` (`0002`/`0008:186-221`) injeta `user_role` +
  `user_modulos`. Frontend: `auth-context.tsx`, `permissoes-context.tsx`, `permissao.ts`.
- Provisionamento: `supabase/functions/config-gerenciar-usuario/index.ts` (cria Auth user + RPC
  `config.provisionar_usuario` + permissões, com rollback), tela `UsuariosPage.tsx`.
- Roteamento: `apps/web/src/app/App.tsx` (só `/login` e `/`; `RequireAuth` só checa `user`).
- Read-model por cliente já pronto e read-only: `obter-visao-cliente.ts`, `cliente-360-gateway.ts`.
- Feature vazia: `apps/web/src/features/area-cliente/.gitkeep`.

## Decisões
### D1 — Vínculo 1:1 `config.usuario_cliente`
Tabela nova (`user_id uuid UNIQUE → auth.users`, `cliente_id uuid → pcm.clientes`, RLS FORCE, escrita
só `service_role`). Um login de síndico ↔ um condomínio (decisão do PO). Multi-unidade fica fora
(pode virar evolução futura reusando Grupo de Clientes E01-S27).

### D2 — Claim `cliente_id` no hook (ADR-0011)
Estender `custom_access_token_hook`: quando `user_role='cliente-sindico'`, ler o vínculo e injetar
`cliente_id` no token. RLS por-linha lê o claim (O(1)), não subconsulta o vínculo.

### D3 — Resolver concede `area-cliente` ao síndico
`resolver_permissoes_modulo` passa a devolver `{area-cliente: leitura}` para `cliente-sindico` (em vez
de vazio). O acesso ao dado real vem da RLS por `cliente_id`, não de módulo `pcm`.

### D4 — RLS por-linha nas tabelas expostas
`pcm.clientes` e demais tabelas lidas pelo portal ganham o ramo:
`OR (user_role='cliente-sindico' AND <col cliente> = (auth.jwt()->>'cliente_id')::uuid)`.
Nesta story: `pcm.clientes` + a base mínima que o Painel (E09-S02) consome. Cada feature futura
adiciona o ramo às suas tabelas.

### D5 — Shell isolada por papel (fase 1, interna)
`App.tsx`: se `papel='cliente-sindico'`, renderiza `<PortalShell>` (nova feature `area-cliente/`) —
**nunca** a `HomePage`/sidebar do SO. `RequireAuth` roteia por papel. Fase 1 é a mesma app/deploy
(iterar rápido); o deploy separado é E09-S11 (defesa-em-profundidade, não o controle primário).

### D6 — Provisionamento pela Visão 360
Botão "Criar acesso" em `VisaoClientePage.tsx` (gate superadmin/supervisor) chama
`config-gerenciar-usuario` **estendida**: cria Auth user `cliente-sindico` com senha (auth local) +
grava o vínculo 1:1, numa operação com rollback (já existente). Reexibe/permite reset de senha, nunca
loga segredo.

## Alternativas descartadas
- **Filtro por subquery de vínculo em cada policy** — custo por-linha; claim é O(1) (ADR-0011).
- **Confiar na shell isolada como isolamento** — ator externo; RLS é o controle primário.
- **Deploy separado já na fundação** — atrasa iteração; fase 2 (E09-S11).

## Impacto
- Migration: `config.usuario_cliente` + alteração do hook + policies por-linha (`pcm.clientes` +
  base do painel). pgTAP obrigatório de isolamento.
- Edge Function de provisionamento estendida + botão na 360.
- Nova feature `area-cliente/` (PortalShell + roteamento por papel).

## Riscos
- Bug no hook vaza `cliente_id` errado → pgTAP de isolamento é gate de merge.
- Esquecer o ramo de RLS numa tabela futura → checklist: toda tabela exposta ao portal nasce com o
  ramo `cliente_id`.
- Troca de vínculo só vale após refresh de token — aceitável.
