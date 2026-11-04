# ADR-0029 — Capacidades por ação e perfis acumuláveis

**Status:** Decisão para implementação local da E01-S170. **Data:** 2026-10-26.

## Contexto

A base atual permite um grupo de módulos por usuário ou permissões individuais de módulo, de forma exclusiva. Essa regra permanece para o acesso legado. O programa exige, adicionalmente, múltiplos perfis de capacidades e concessões individuais com escopo por Cliente, revogáveis sem esperar renovação do token. Escrita genérica de PCM não autoriza gestão de Plano.

## Decisão

- Criar no schema `config` catálogo de ações, perfis próprios de capacidades, associação múltipla usuário/perfil e concessões de capacidade individuais ou de perfil, cada uma com escopo global explícito ou Cliente. São aditivos e não alteram `config.grupos`, `usuario_modulos` ou seus vínculos existentes.
- Resolver permissões atuais no servidor: usuário ativo, módulo necessário e ao menos uma concessão ativa cuja ação e escopo correspondam. Ausência nega; técnico e cliente não recebem privilégios internos por inferência.
- `plano.gerir` exige concessão **individual**, mesmo que um perfil ou papel administrativo a contenha. A concessão específica permite autoaprovação; identidades de pessoas nunca são codificadas. Administração de concessões exige superadmin ativo; esse papel não substitui a concessão individual de gestão do Plano.
- Escritas de configuração ocorrem por RPC transacional com `request_id` UUID, revisão otimista e auditoria append-only; repetição idêntica devolve o mesmo resultado, reutilização da chave para outro conteúdo ou revisão antiga falha. Alterar ou revogar preserva histórico e não exige revogação do usuário no Auth.
- Tabelas com RLS FORCE negam escrita direta; acesso por RPC com `search_path` fixo e validação da sessão atual. Eventos em `audit.events` não podem ser alterados ou excluídos, inclusive por `service_role`; cobertura pgTAP valida os dois lados.

## Compatibilidade e limites

As capacidades não se convertem automaticamente a partir de permissões de módulo, grupo ou nome de usuário. Em migração, nenhuma concessão crítica é presumida. Um perfil pode ser reutilizado por vários usuários e um usuário acumula perfis, sem modificar o vínculo legado de grupo de módulo. Ao revogar perfil, concessão ou usuário, consultas subsequentes usam estado atual. Atribuição e revogação de perfis e concessões precisam ser auditáveis e idempotentes; uso efetivo de uma ação permanece responsabilidade da RPC da respectiva story.

Anexos, dados de produção e contrato externo Auvo não são alterados nesta decisão. A migração é local até rollout autorizado; revisão adversarial e testes de banco antecedem PASS.
