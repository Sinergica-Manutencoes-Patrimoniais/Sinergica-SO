---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Grupos e Permissões por Módulo: Fundação

> **Fonte da verdade.** Status: aprovado
> Tier: Arquitetural. `design.md` presente. `docs/adr/0004-permissoes-por-modulo-grupos.md`
> estende `docs/adr/0003-rbac-jwt-claim-config-usuarios.md` (não edita).

## Resumo
`superadmin`/`supervisor` passam a poder criar grupos de permissão por módulo e atribuir
usuários a um grupo ou a permissões individuais — mutuamente exclusivo — com o resultado
propagado via JWT (mesmo mecanismo O(1) do RBAC atual). Criação de usuário passa a ser possível
via Edge Function, não só SQL Editor.

## Critérios de aceite

### AC-1: `superadmin`/`supervisor` criam grupo com permissão por módulo
- **Dado** um usuário autenticado com `papel` `superadmin` ou `supervisor`
- **Quando** insere em `config.grupos` e `config.grupo_modulos` (ex.: módulo `pcm` = `escrita`,
  módulo `comercial` = `leitura`)
- **Então** a operação é aceita pela RLS; qualquer outro papel (`colaborador`,
  `cliente-sindico`) tem a mesma operação negada.

### AC-2: Exclusividade grupo × individual é garantida por trigger
- **Dado** um usuário com `config.usuarios.grupo_id` já setado
- **Quando** alguém tenta inserir uma linha em `config.usuario_modulos` para esse mesmo usuário
- **Então** a operação é recusada com erro claro (não insere estado inconsistente) — e
  simetricamente, tentar setar `grupo_id` num usuário que já tem linhas em `usuario_modulos`
  também é recusado.

### AC-3: `config.definir_permissao_usuario` troca de modo atomicamente
- **Dado** um usuário atualmente no modo grupo (ou individual)
- **Quando** `config.definir_permissao_usuario(user_id, novo_modo)` é chamada para trocar para
  o outro modo
- **Então** a troca acontece numa única transação, sem estado intermediário onde o usuário teria
  simultaneamente `grupo_id` setado e linhas em `usuario_modulos`.

### AC-4: `resolver_permissoes_modulo` retorna o resultado certo nos dois modos
- **Dado** um usuário com `grupo_id` setado e um grupo com permissões configuradas
- **Quando** `config.resolver_permissoes_modulo(user_id)` é chamada
- **Então** retorna exatamente as permissões do grupo.
- **E**, para um usuário com `grupo_id is null` e linhas próprias em `usuario_modulos`, retorna
  exatamente essas linhas.
- **E**, para um usuário sem grupo e sem linhas individuais, retorna vazio.

### AC-5: `custom_access_token_hook` emite `user_modulos` fiel ao resolver
- **Dado** um usuário com permissões resolvidas por `resolver_permissoes_modulo`
- **Quando** ele faz login ou tem o token renovado
- **Então** o JWT emitido carrega o claim `user_modulos` como um objeto `{modulo: nivel}`
  idêntico ao resultado do resolver no momento da emissão.

### AC-6: `config.minhas_permissoes` só retorna dados do próprio usuário
- **Dado** dois usuários autenticados diferentes, nenhum `superadmin`/`supervisor`
- **Quando** cada um consulta `config.minhas_permissoes`
- **Então** cada um vê só as próprias permissões — nunca as do outro. Chamar
  `resolver_permissoes_modulo` passando o `user_id` de outro usuário (sem ser
  `superadmin`/`supervisor`) lança exceção.

### AC-7: RLS de domínio nega/permite por módulo e nível
- **Dado** um usuário com `user_modulos->>'pcm' = 'leitura'` (sem `'escrita'`)
- **Quando** ele faz `SELECT` em `pcm.clientes`
- **Então** a leitura é permitida.
- **E** um `INSERT`/`UPDATE` na mesma tabela é negado (exige `'escrita'`).
- **E** `superadmin` sempre passa, independente do claim `user_modulos`.
- **E** um usuário sem o módulo `atendimento` no claim não vê nada em
  `atendimento.config_ze`/`wa_messages`/`wa_queue`; idem para `comercial.leads` e módulo
  `comercial`.

### AC-8: `config.feature_flags` vira superadmin-only
- **Dado** um usuário com `papel = 'supervisor'`
- **Quando** ele tenta `SELECT` em `config.feature_flags`
- **Então** é negado (perdeu a leitura que tinha antes desta story) — só `superadmin` lê/escreve.

### AC-9: Usuário inativo não recebe nenhuma permissão de módulo
- **Dado** `config.usuarios.ativo = false`
- **Quando** o token dele é emitido/renovado (ou `resolver_permissoes_modulo` é chamado para
  ele)
- **Então** `user_modulos` vem vazio, mesmo que ele tenha grupo ou permissões individuais
  configuradas — mesma regra que já vale para `papel` hoje.

### AC-10: `supervisor` não consegue promover ninguém a `superadmin`
- **Dado** um usuário autenticado com `papel = 'supervisor'`
- **Quando** ele tenta `UPDATE config.usuarios SET papel = 'superadmin'` em qualquer linha
  (inclusive a própria)
- **Então** a operação é negada pela RLS — só quem já é `superadmin` pode promover a
  `superadmin`.

### AC-11: Edge Function cria usuário de ponta a ponta
- **Dado** uma requisição autenticada como `superadmin`/`supervisor` para
  `config-gerenciar-usuario` com `{email, senha, nome, papel, modo}`
- **Quando** a função processa
- **Então** cria o usuário no Supabase Auth, vincula `papel`/`nome` via `provisionar_usuario`, e
  aplica `modo` (grupo ou permissões individuais) via `definir_permissao_usuario` — o usuário
  criado já consegue logar e ver os módulos certos no primeiro login.
- **E** uma requisição da mesma função por um usuário `colaborador`/`cliente-sindico` (ou sem
  autenticação) é rejeitada antes de qualquer chamada à Auth Admin API.

## Casos de borda e erros
- Grupo `ativo = false`: usuários apontando para ele resolvem para "sem permissão nenhuma" (não
  é erro, é o comportamento esperado de fail-closed) — não é um AC separado porque o resolver já
  filtra por `grupo_id is not null`, mas não checa `ativo` do grupo; **decisão de
  implementação**: o `join` do resolver deve incluir `grupos.ativo = true` explicitamente (task
  correspondente cobre isso).
- Deletar um grupo (`on delete cascade` em `grupo_modulos`, `on delete set null` em
  `usuarios.grupo_id`): usuários que apontavam pra ele ficam sem permissão até reatribuição —
  comportamento fail-closed intencional, não um bug.
- Edge Function recebendo `modo` inválido (nem grupo nem individual bem formado): retorna erro
  4xx claro, não cria o usuário parcialmente (Auth user + papel sem permissão nenhuma é um
  estado válido de fallback, mas o contrato da função deve validar o `modo` antes de criar o
  Auth user, para evitar usuário órfão sem permissão por erro de input).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Qualquer UI/tela — `E00-S10`.
- Granularidade menor que módulo inteiro.
- Combinar grupo + permissão individual (override) para o mesmo usuário.
- Mudar o comportamento de `cliente-sindico`.
- Reflexo instantâneo de mudança de permissão (mesmo trade-off do `ADR-0003`).

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md` · Domínio: `./domain.md`
- ADRs relacionados: `docs/adr/0003-rbac-jwt-claim-config-usuarios.md` (estendido, não editado),
  `docs/adr/0004-permissoes-por-modulo-grupos.md` (novo, criado por esta story)
