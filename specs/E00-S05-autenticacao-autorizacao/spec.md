---
name: spec
description: Contrato da story E00-S05 — Autenticação e Autorização (Supabase Auth real + RBAC).
alwaysApply: true
---

# Spec — E00-S05: Autenticação e Autorização

> **Fonte da verdade.** Status: aprovado
> Épico: E00 — Shell & Infra · Tier: arquitetural

## Resumo

O sistema passa a autenticar usuários via **Supabase Auth** (e-mail/senha real, sessão via SDK),
resolvendo o **papel** (`admin` | `escritorio` | `tecnico` | `cliente-sindico`) a partir de uma
tabela de perfis vinculada a `auth.users`, e aplica um padrão de **RLS por papel** nas tabelas de
domínio já existentes. O bypass de desenvolvimento é removido do código.

## Critérios de aceite

### AC-1: Login real substitui o bypass de desenvolvimento
- **Dado** a página de login está aberta e o usuário tem uma conta válida no Supabase Auth
- **Quando** o usuário submete e-mail e senha corretos
- **Então** uma sessão real é criada via Supabase Auth (JWT), o usuário é redirecionado à home, e
  nenhuma credencial hardcoded (`trivia@triviastudio.com.br` / `Trivia123456`) existe mais no
  código-fonte

### AC-2: Credenciais inválidas não revelam qual campo está errado
- **Dado** a página de login está aberta
- **Quando** o usuário submete e-mail ou senha incorretos
- **Então** o formulário exibe uma mensagem genérica de erro (ex.: "Usuário ou senha inválidos"),
  sem diferenciar "e-mail não existe" de "senha errada", e nenhuma sessão é criada

### AC-3: Papel do usuário é resolvido a partir do banco, não do cliente
- **Dado** um usuário autenticado com sucesso
- **Quando** a aplicação precisa saber seu papel (para UI condicional ou chamadas ao banco)
- **Então** o papel é lido de uma tabela de perfis no Postgres vinculada 1:1 a `auth.users.id`
  (não é enviado pelo cliente nem inferido do e-mail)

### AC-4: Todo novo usuário tem um perfil com papel definido
- **Dado** um novo usuário é criado em `auth.users` (via Supabase Dashboard/SQL, conforme
  Non-goals do `product.md`)
- **Quando** o registro de perfil correspondente é criado
- **Então** o perfil sempre tem um papel válido dentre os 4 definidos — nunca `null` — e a
  ausência de perfil para um `auth.users` existente é tratada explicitamente (login bloqueado com
  mensagem clara, não erro genérico/crash)

### AC-5: Sessão persiste entre reloads e expira corretamente
- **Dado** um usuário autenticado
- **Quando** ele recarrega a página ou fecha e reabre o navegador dentro da validade do token
- **Então** a sessão continua ativa (refresh automático via SDK do Supabase), sem exigir novo
  login, e sem depender de `localStorage` gerido manualmente pela aplicação

### AC-6: Logout invalida a sessão real
- **Dado** um usuário autenticado
- **Quando** ele clica em "Sair"
- **Então** a sessão é invalidada no Supabase (`auth.signOut()`), o estado local é limpo, e o
  usuário é redirecionado para `/login`

### AC-7: Rotas internas exigem sessão válida
- **Dado** um visitante sem sessão ativa
- **Quando** ele tenta acessar qualquer rota interna (dashboard, módulos) diretamente pela URL
- **Então** é redirecionado para `/login` antes de qualquer dado ou tela protegida ser exibido
  (sem "flash" de conteúdo protegido)

### AC-8: Padrão de RLS por papel aplicado às tabelas de domínio existentes
- **Dado** o helper de "papel do usuário atual" definido no banco (ex.: função SQL consultável
  dentro de uma policy)
- **Quando** qualquer papel autenticado faz uma operação nas tabelas `pcm.clientes`,
  `pcm.ordens_servico`, `atendimento.config_ze`, `atendimento.wa_messages`,
  `atendimento.wa_queue`, `comercial.leads` e `config.feature_flags`
- **Então** a operação é permitida ou negada conforme a matriz de decisão abaixo — nunca por
  ausência de policy (RLS FORCE já exige isso, mas hoje não há policy de acesso real)

### AC-9: Usuário sem papel reconhecido não acessa nenhum dado de domínio
- **Dado** um usuário autenticado cujo perfil não tem papel válido (estado de erro do AC-4) ou
  cujo token não resolve a nenhuma linha em profiles
- **Quando** ele tenta ler qualquer tabela protegida pelo padrão de RLS
- **Então** todas as queries retornam vazio (deny by default) — nunca erro 500 nem exposição de
  dado

## Matriz de decisão — acesso por papel às tabelas de domínio

| Papel | `pcm.clientes` | `pcm.ordens_servico` | `atendimento.*` | `comercial.leads` | `config.feature_flags` | AC |
|---|---|---|---|---|---|---|
| `admin` | leitura + escrita | leitura + escrita | leitura + escrita | leitura + escrita | leitura + escrita | AC-8 |
| `escritorio` | leitura + escrita | leitura + escrita | leitura + escrita | leitura + escrita | somente leitura | AC-8 |
| `tecnico` | somente leitura | somente leitura* | sem acesso | sem acesso | sem acesso | AC-8 |
| `cliente-sindico` | sem acesso | sem acesso | sem acesso | sem acesso | sem acesso | AC-8 |
| sem papel válido | sem acesso | sem acesso | sem acesso | sem acesso | sem acesso | AC-9 |

> \* `tecnico` com escrita restrita ao próprio registro (ex.: OS onde é responsável) fica para a
> story de domínio (E01) — aqui o recorte é amplo (somente leitura) para não bloquear o padrão.

## Casos de borda e erros

- **Perfil ausente para usuário autenticado:** login bloqueado com mensagem "Conta sem perfil
  configurado — contate o administrador." (não crash, não acesso default a nenhum papel).
- **Token expirado durante uso:** SDK do Supabase tenta refresh automático; se falhar, sessão é
  encerrada e usuário redirecionado a `/login` com mensagem "Sessão expirada, faça login
  novamente."
- **Concorrência — dois logins simultâneos do mesmo usuário:** ambos válidos (comportamento
  padrão do Supabase Auth); não é tratado nesta story.
- **Falha de rede durante login:** mensagem de erro genérica de conexão, sem travar o botão de
  submit indefinidamente (timeout tratado).

## Fora de escopo

> Vinculante. Não implemente nada aqui.
- SSO / login social (Google, Microsoft).
- MFA.
- Tela customizada de "esqueci minha senha" (usar fluxo padrão do Supabase Auth).
- Telas de administração de usuário (convite, criação, desativação via UI).
- Autenticação do papel `cliente-sindico` via WhatsApp/portal (pertence a E09 — Área do Cliente).
- Policies granulares de "dono do registro" (ex.: técnico só vê a própria OS) — fica para as
  stories de cada domínio, que devem reusar o helper de papel criado aqui.

## Rastreabilidade

- Product: `./product.md` · Design: `./design.md` · Domínio: `docs/glossary.md` (papéis já
  documentados em `docs/PROJECT.md`)
- ADRs relacionados: a ser criado por `@architect` em `docs/adr/` para a decisão de modelo de
  perfil (trigger vs. explícito) e local do helper de RLS
