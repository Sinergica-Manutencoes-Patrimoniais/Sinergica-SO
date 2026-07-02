---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Renomear papéis RBAC (admin/escritorio/tecnico → superadmin/supervisor/colaborador)

> **Fonte da verdade.** Status: aprovado
> Tier: Pequeno — decisão de mecanismo (JWT claim + `config.usuarios`, ADR-0003) já existe e não
> muda; isto é um rename 1:1 confirmado com o usuário, sem nova regra de permissão. Sem
> `design.md` (não há alternativa a pesar — é vocabulário, não arquitetura).

## Resumo
Os papéis internos do Sinérgica SO passam a se chamar `superadmin`, `supervisor` e `colaborador`
(antes `admin`, `escritorio`, `tecnico`) — mesma matriz de permissão de `E00-S05`, só o nome
muda. `cliente-sindico` não muda (ator externo, fora da hierarquia de colaborador).

## Critérios de aceite

### AC-1: Constraint de `config.usuarios.papel` aceita os novos valores
- **Dado** as migrations `0004_E00-S08_renomear_papeis_rbac.sql` +
  `0005_E00-S08_validar_constraint_papel.sql` aplicadas
- **Quando** alguém tenta `insert`/`update` em `config.usuarios` com `papel` igual a
  `'superadmin'`, `'supervisor'`, `'colaborador'` ou `'cliente-sindico'`
- **Então** a constraint aceita; qualquer outro valor (incluindo os antigos `'admin'`,
  `'escritorio'`, `'tecnico'`) é rejeitado pelo `check`.

### AC-2: Linhas existentes com papel antigo são remapeadas automaticamente
- **Dado** uma linha em `config.usuarios` com `papel = 'admin'` (criada antes desta migration,
  sob a constraint antiga)
- **Quando** a migration `0004` roda
- **Então** essa linha passa a ter `papel = 'superadmin'` (mesmo mapeamento para
  `escritorio→supervisor`, `tecnico→colaborador`) — sem exigir re-provisionamento manual.

### AC-3: Toda RLS policy que referenciava os papéis antigos passa a referenciar os novos, mesma matriz de permissão
- **Dado** as ~19 policies de `pcm.clientes`, `pcm.ordens_servico`, `atendimento.config_ze`,
  `atendimento.wa_messages`, `atendimento.wa_queue`, `comercial.leads`, `config.feature_flags`,
  `config.usuarios` (criadas em `0002_E00-S05_perfis_rbac.sql`)
- **Quando** a migration `0004` roda (via `alter policy`, preservando as policies — não
  `drop`+`create`)
- **Então** cada `in (...)`/`=` que citava `admin`/`escritorio`/`tecnico` passa a citar
  `superadmin`/`supervisor`/`colaborador` respectivamente, na mesma posição/mesma regra —
  `cliente-sindico` continua idêntico em todas.

### AC-4: `custom_access_token_hook` e `provisionar_usuario` continuam funcionando sem alteração de código
- **Dado** que nenhuma das duas funções tem os nomes de papel hard-coded (só repassam o que está
  em `config.usuarios.papel`, validado pela constraint)
- **Quando** a migration `0004` roda
- **Então** nenhuma delas precisa ser recriada — o claim `user_role` no JWT passa a carregar
  `superadmin`/`supervisor`/`colaborador` automaticamente assim que o usuário tiver um novo
  refresh de token, sem mudança de função.

### AC-5: `Papel` (TypeScript) e o pgTAP de RBAC refletem os novos valores
- **Dado** `apps/web/src/features/auth/domain/role.ts` (union type + `isPapel`) e
  `supabase/tests/e00-s05_rbac.test.sql` (matriz de decisão via pgTAP)
- **Quando** atualizados nesta story
- **Então** `Papel` é `"superadmin" | "supervisor" | "colaborador" | "cliente-sindico"`, e o
  pgTAP continua com as mesmas 29 asserções, só trocando os literais de papel testados — mesma
  cobertura de matriz, vocabulário novo.

### AC-6: Usuário `sinergicaengenharia@gmail.com` está provisionado como `superadmin` após a migration
- **Dado** que este usuário já foi criado no Supabase Auth e vinculado a `config.usuarios` com
  `papel = 'admin'` (provisionado antes desta migration existir, para não bloquear o acesso)
- **Quando** a migration `0004` roda em produção (merge desta PR)
- **Então** o remap do AC-2 atualiza essa linha específica para `papel = 'superadmin'`
  automaticamente — sem passo manual adicional.

## Casos de borda e erros
- Se `config.usuarios` tiver uma linha com papel que já não bate com nenhum dos 4 valores
  antigos nem novos no momento da migration (não deveria existir, a constraint antiga impedia),
  a migration não tenta adivinhar — o `add constraint` no final falhará alto e visível (não
  silencioso), forçando correção manual antes do deploy prosseguir.
- Ordem de execução importa: a migration primeiro remove a constraint antiga, **depois** remapeia
  os dados, **depois** adiciona a constraint nova — nessa ordem (remapear com a constraint antiga
  ainda ativa rejeitaria os valores novos).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Qualquer mudança na matriz de **permissão** em si (quem pode ler/escrever o quê) — é
  exclusivamente rename, confirmado com o usuário.
- Mudar `cliente-sindico` — fica exatamente como está.
- Tela de administração de usuários (self-service) — mesmo non-goal já registrado em
  `specs/E00-S05-autenticacao-autorizacao/product.md`.
- Editar `docs/adr/0003-rbac-jwt-claim-config-usuarios.md` — ADR é imutável; a decisão de
  mecanismo (JWT claim + `config.usuarios`) continua válida, só o vocabulário mudou (não
  justifica um ADR novo — não há alternativa nova sendo pesada).
- Reescrever `specs/E00-S05-autenticacao-autorizacao/*.md` — ficam como registro histórico do que
  foi decidido/construído naquele momento; este story documenta a evolução, não reescreve o
  passado.

## Rastreabilidade
- Spec anterior (mecanismo original): `specs/E00-S05-autenticacao-autorizacao/spec.md`
- ADR (mecanismo, não muda): `docs/adr/0003-rbac-jwt-claim-config-usuarios.md`
- Origem: instrução direta do usuário ("Teremos as roles: Superadmin, supervisor, colaborador"),
  com mapeamento 1:1 confirmado via pergunta de esclarecimento nesta sessão.
