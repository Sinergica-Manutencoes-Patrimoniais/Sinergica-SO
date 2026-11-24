---
name: contas-de-teste-2026-11-24
description: As cinco contas de teste por perfil criadas em produção para a sessão de aceite, com a matriz de permitido e negado medida contra o ambiente publicado.
alwaysApply: false
---

# Contas de teste por perfil — sessão de aceite

Criadas em 24/11/2026 em produção (`nudannsrfvjggoergvyn`) pela Edge Function
`config-gerenciar-usuario`, com e-mail já confirmado. Atendem ao pedido do Fabrício de
*"login de teste por perfil"*.

**A senha não está neste arquivo e não entra no repositório** — foi entregue fora do git. Todas as
cinco compartilham a mesma senha de homologação, trocável a qualquer momento pelo fluxo padrão do
Supabase Auth.

Ambiente: <https://so-sinergica.netlify.app> · Cliente de escopo: **Sinérgica - Escritório**
(`741a283b-8e23-449f-83c7-668f35c98f20`).

## As contas

| Perfil | Login | Papel | Módulos |
|---|---|---|---|
| Gestor PCM | `sinergicaengenharia+gestorpcm@gmail.com` | `supervisor` | pcm escrita · gestao escrita · financeiro leitura |
| Operador PCM | `sinergicaengenharia+operadorpcm@gmail.com` | `colaborador` | pcm escrita |
| Inspetor | `sinergicaengenharia+inspetor@gmail.com` | `colaborador` | pcm escrita |
| Financeiro | `sinergicaengenharia+financeiro@gmail.com` | `colaborador` | financeiro escrita · comercial leitura |
| Comercial | `sinergicaengenharia+comercial@gmail.com` | `colaborador` | comercial escrita · pcm leitura |

Cada conta tem um perfil de capacidades próprio (`Homologação — <perfil>`) com as concessões
herdáveis, mais as concessões nominais da sua coluna em `capacidades-sso-2026-11-24.md`. **Todas
as concessões estão escopadas ao Cliente Sinérgica - Escritório**, de propósito: é o que permite
provar o caso negado em outro Cliente.

## Matriz medida no ambiente publicado

Medição real: `config.sso_autorizar_acao(acao, cliente)` chamada com o token de cada conta, para
as 25 capacidades, em dois Clientes.

| Perfil | Permitidas no Escritório | Negadas | Permitidas em outro Cliente |
|---|---|---|---|
| Gestor PCM | 17 | 8 | **0** |
| Operador PCM | 9 | 16 | **0** |
| Inspetor | 4 | 21 | **0** |
| Financeiro | 3 | 22 | **0** |
| Comercial | 6 | 19 | **0** |

**Escopo por Cliente provado:** nenhuma das cinco contas autoriza uma única capacidade fora do
Cliente concedido.

### Pares permitido × negado prontos para a sessão

| O que demonstrar | Permitido | Negado |
|---|---|---|
| Validação PCM / Campo a conciliar / Monitor T−24 (todos exigem `execucao.validar`) | Gestor PCM | Operador PCM recebe `sem_acesso` |
| Leitura da operação | Operador PCM lê Clientes e OS | Financeiro lê **0** Clientes e **0** OS |
| Perfil de outro usuário | — | Operador PCM lê só a própria linha em `config.usuarios` |
| Escopo por Cliente | Gestor PCM no Escritório | O mesmo Gestor em Portal Recantos de Rimini: tudo negado |

## Dois achados desta preparação

### 1. Campo a conciliar e Monitor T−24 exigem `execucao.validar`, não `integracao.reconciliar`

As migrations `1866` e `1867` checam `config.sso_autorizar_acao('execucao.validar', cliente)`.
A proposta do Fabrício diz que o Operador PCM *"concilia OS de campo"* e que a validação de
execução *"depende da atribuição definida para a pessoa"* — as duas coisas juntas não se sustentam
hoje: **sem `execucao.validar` o Operador não vê nem a fila de conciliação nem o monitor**.
É preciso decidir: ou o Operador recebe `execucao.validar`, ou essas duas telas passam a exigir
`integracao.reconciliar`, que é a capacidade com o nome certo para conciliar.

### 2. A área administrativa aparece para perfil operacional

Com a conta Operador PCM (`colaborador`, único módulo `pcm`), o menu mostra o grupo
**ADMINISTRAÇÃO** inteiro, e Configurações abre com as abas Grupos, Usuários, Integrações, IA,
Gasto de IA, Priorização e Localização Auvo, com o botão "Novo grupo" habilitado.

O dado continua protegido — `config.usuarios` devolve só a própria linha, pelo RLS — e a escrita
de grupo é recusada, **mas por gate fechado (`config.sso_grupo_atomico_gate`), não por
permissão**: o administrador recebe a mesma recusa. Ou seja, a tela não esconde a área
administrativa de um perfil operacional. É o roteiro 6 do Fabrício (*"com perfil operacional,
testar o acesso direto a uma rota administrativa"*) e precisa de decisão própria.

## Estado dos dados para a sessão

Varredura dos **56 Clientes ativos** com a conta de administrador, em 24/11:

- **Campo a conciliar: nenhuma OS** em nenhum Cliente.
- **Monitor Auvo T−24: nenhuma exceção** em nenhum Cliente.
- **Agenda do Técnico:** nenhuma Visita planejada na semana corrente.

As três telas abrem, autorizam e respondem corretamente — **mas não têm o que mostrar**. Os
registros de exemplo dos roteiros 1, 2 e 3 precisam ser semeados antes da sessão, com uma Visita
de teste em Sinérgica - Escritório que exercite o T−24.

## Como revogar depois da homologação

Pelas próprias telas de Capacidades (desativar perfil ou concessão) ou, no Dashboard,
Authentication → Users → revogar sessões e excluir as cinco contas. Nenhuma delas tem vínculo com
Cliente do portal, então excluir não deixa órfão.
