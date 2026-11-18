---
name: plan
description: Detalhe técnico de E00-S27 — generaliza o padrão de releitura ao vivo de 0234. Puxe ao implementar.
alwaysApply: false
---

# Plan — E00-S27 · Revogação imediata de acesso

Ver `docs/adr/1691-revogacao-imediata-generaliza-s184.md` para a decisão completa.

## O que já existia (não reconstruir)

- `config.s184_acesso_interno_atual(modulo)` (`0234`) — releitura ao vivo como policy RESTRICTIVE, em produção, provada por `E01-S184_protecao_custos_portal_us3.test.sql`.
- `config.sso_autorizar_acao` (`0239`) — mesma ideia, lado RPC, já usado por dezenas de funções.

## Migration `1859_E00-S27_revogacao_imediata.sql`

- `config.sso_acesso_atual(p_modulo, p_nivel)` — generalização de `0234`.
- `config.sso_revogar_usuario`/`config.sso_reativar_usuario` — comando auditado (CQRS, idempotente por `request_id`, `audit.events`). Bloqueiam autorrevogação (achado de `/revisao-adversarial`).
- `config.sso_revogacoes_usuario` — log append-only do comando.

## CI

`scripts/check-revogacao-coberta.mjs`, step novo em `ci.yml` ("Revogação imediata — policy nova sem releitura ao vivo"). Escopo: só migrations ≥ 1855 — não retrofita o histórico (universo desconhecido sem inventário próprio).

## pgTAP

`E00-S27_revogacao_imediata.test.sql`, 13 assertions — o núcleo é provar que a MESMA sessão (mesmo JWT fixado antes da revogação, nunca trocado) perde e recupera acesso sem novo login:

| AC | Provado como |
|---|---|
| AC-1 | módulo e RPC sensível negados com o MESMO JWT, logo após revogar |
| AC-2 | estrutural — a checagem é por `usuario_id`, nunca por sessão; não existe conceito de "dispositivo" pra vazar |
| AC-3 | `sso_revogar_usuario` audita ator+alvo+motivo+momento |
| AC-4 | revogar só a concessão (não o usuário) também nega na mesma sessão, sem se confundir com reativação do usuário |
| AC-5 | não aplica — sem camada de cache neste repo |
| AC-6 | `sso_reativar_usuario` audita e restaura acesso, mesma sessão |
| AC-7 | a mesma função serve RLS e RPC — uma implementação, não duas |
| AC-8 | coberto pelo gate de CI, não por pgTAP |

## Alcance no front — feito

`config-gerenciar-usuario` só CRIA usuário (nunca desativava — não havia caminho de revogação
nenhum, nem via Edge Function nem via UI, confirmado por grep). Adicionada seção "Revogar ou
reativar usuário" em `CapacidadesWorkspace.tsx` (painel já existente, superadmin), chamando
`sso_revogar_usuario`/`sso_reativar_usuario` direto (não entra no dispatcher genérico de
perfil/vínculo/concessão do mesmo arquivo — contrato de resposta diferente, forçar o mesmo
formato exigiria mudar a migration só pra caber na UI). Idempotência própria via
`sessionStorage`, mesmo padrão usado em outros componentes autônomos da sessão (ex.:
`PromoverComposicao.tsx`). Teste novo em `Workspace.test.tsx` prova o caminho feliz.

## Riscos

- Dívida de retrofit do histórico de RLS policies fica aberta, por desenho (fora de escopo — ver ADR). Não é "pendência esquecida", é limite consciente desta story.
