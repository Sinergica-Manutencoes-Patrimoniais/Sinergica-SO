# Feature Specification: Capacidades sensíveis ponta a ponta

**Story:** E00-S26 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E00-S26-capacidades-sensiveis`
**Status:** Especificada — implementação não iniciada.

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 005** e seção 10 ("Perfis, permissões e navegação").
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

A fundação existe: `0006_E00-S09_grupos_permissoes_modulo.sql` dá leitura/escrita **por módulo**, e
`0239_E01-S170_capacidades_sso.sql` já criou `config.sso_acoes` (com `nivel` e
`exige_concessao_individual`), `config.sso_perfis` e `config.sso_usuario_perfis`.

O achado do Fabrício é que isso **concede poder amplo demais**: quem tem escrita num módulo pode
aprovar, cancelar, exportar e ver custo interno. O pacote nomeia sete capacidades sensíveis que
precisam ser próprias: **planejar, validar, aprovar, cancelar, exportar, visualizar valores internos
e administrar usuários/configurações**.

A regra aprovada é dupla: pessoas **não ficam codificadas** nas regras (recebem grupos e
capacidades), e **API, Módulo de Campo e MCP herdam a mesma identidade e autorização** — não têm
caminho próprio.

Esta story **completa** `config.sso_acoes`; não a reescreve. Difere de `E01-S189`, que fecha grants
de escritores específicos sem gate: aqui o objeto é a matriz de capacidades, não a lista de RPCs.

## User Scenarios & Testing

### US1 — Escrita operacional não é aprovação (Priority: P1)

**Why this priority:** É a confusão que concede poder hoje; tudo o mais depende dela.

**Independent Test:** Dar a um usuário escrita operacional em PCM sem nenhuma capacidade sensível e
tentar aprovar um plano, cancelar um Chamado e abrir uma tela com custo interno.

**Acceptance Scenarios:**

- **AC-1:** Dado um Operador PCM com escrita no módulo e **sem** a capacidade `aprovar`, quando tentar aprovar um plano, então a operação é **recusada no servidor** com erro de autorização — e não apenas escondida na interface.
- **AC-2:** Dado o mesmo usuário sem `visualizar_valores_internos`, quando abrir qualquer tela ou RPC que exponha custo de aquisição, markup, margem ou tributo interno, então os campos **não são retornados pelo servidor** — não são retornados e mascarados no cliente.
- **AC-3:** Dado um usuário com `cancelar` mas sem `aprovar`, quando cancelar um Chamado, então a operação é aceita e **auditada** com ator, capacidade usada e momento.

### US2 — Cada perfil só faz o que é dele (Priority: P1)

**Why this priority:** O pacote nomeia os limites por perfil; sem matriz negativa eles não existem.

**Independent Test:** Rodar a matriz positiva e negativa de capacidades × perfis como pgTAP.

**Acceptance Scenarios:**

- **AC-4:** Dado o perfil Financeiro, quando tentar alterar qualquer objeto da operação (Chamado, OS, Visita, Pendência), então é recusado — Financeiro **consulta** a origem operacional, não a altera.
- **AC-5:** Dado o perfil Cliente, quando tentar ler dado de outro condomínio por qualquer caminho (tela, RPC, API), então é recusado por isolamento de Cliente, não por filtro de interface.
- **AC-6:** Dado o perfil Inspetor, quando tentar aprovar o próprio levantamento ou escrever direto no cadastro oficial, então é recusado — ele cria coleta e sugestão, nunca o registro oficial.

### US3 — Nenhuma pessoa dentro da regra (Priority: P2)

**Why this priority:** É o que mantém a autorização administrável sem deploy.

**Acceptance Scenarios:**

- **AC-7:** Dado qualquer ponto de decisão de autorização no banco ou na borda, quando auditado, então **nenhum identificador de pessoa física** (e-mail, nome, `user_id` fixo) aparece na regra — só grupo e capacidade.
- **AC-8:** Dado um grupo novo criado pela administração, quando receber capacidades, então ele passa a valer **sem deploy** e o evento fica auditado.

### Edge Cases

- Usuário com duas atribuições conflitantes (grupo concede, concessão individual nega): a decisão precisa ser determinística e documentada.
- Capacidade concedida e retirada no mesmo dia: o histórico precisa mostrar as duas pontas.
- Ação sensível disparada por Edge Function com `service_role`: tem que carregar a identidade do usuário de origem, nunca se autorizar sozinha.

## Requirements

### Functional Requirements

- **FR-001:** Registrar as sete capacidades sensíveis em `config.sso_acoes` e exigi-las nos escritores correspondentes, conforme AC-1, AC-3.
- **FR-002:** Restringir no **servidor** o retorno de valores internos à capacidade própria, conforme AC-2.
- **FR-003:** Fechar a matriz negativa por perfil (Financeiro, Cliente, Inspetor), conforme AC-4, AC-5, AC-6.
- **FR-004:** Proibir identificador de pessoa dentro da regra de autorização, conforme AC-7.
- **FR-005:** Propagar identidade e capacidade para API, Módulo de Campo e MCP — sem caminho de autorização paralelo.
- **FR-006:** Auditar toda concessão, revogação e uso de capacidade sensível em `audit.*` append-only.

### Key Entities

Nenhuma entidade nova. `config.sso_acoes` ganha as linhas das capacidades sensíveis;
`config.sso_perfis`/`sso_usuario_perfis` passam a ser o caminho único de concessão.

## Success Criteria

- **SC-001:** Matriz positiva **e negativa** coberta por pgTAP, com permitido e negado para cada capacidade.
- **SC-002:** Nenhuma RPC sensível alcançável por escrita de módulo isolada.
- **SC-003:** Nenhum custo interno sai do servidor para quem não tem a capacidade.
- **SC-004:** Toda concessão aparece em `audit.*`.

## Assumptions & Dependencies

- Depende de `E00-S09` (grupos) e `E01-S170` (capacidades) — ambas já existem.
- Precede `E01-S198` (API de domínio) e `E02-S43` (MCP): os dois herdam esta autorização.
- Tier **arquitetural**: exige ADR e `/revisao-adversarial` antes do PASS.

## Alcance no front — obrigatório nesta story

Regra transversal criada em 17/11/2026. Medição que a motiva:
`docs/Apontamentos/alcance-no-front-2026-11-17.md` — **694** flags `VITE_SSO_*` usadas e nunca
declaradas, **227** `return null` silenciosos, **583** gates `default false` contra **1** migration
que já abriu algum. O efeito medido: regra fechada em produção (Chamado 1:N, `1842`) e **nenhum
botão** na tela.

**Esta story não está concluída quando o pgTAP passa. Está concluída quando o operador alcança a
ação na tela.** Os critérios abaixo valem como AC e entram no Definition of Done do PR:

- **AC-F1:** Toda capacidade entregue tem UI alcançável por um perfil real, com o **caminho de navegação nomeado** (menu → tela → ação) no `plan.md`.
- **AC-F2:** Toda flag `VITE_SSO_*` introduzida ou usada é **declarada no mesmo PR** em `.env.example` e `netlify.toml`, com valor explícito — `false` quando a decisão é continuar desligada.
- **AC-F3:** Recurso desligado por flag ou gate mostra o estado **"disponível, não ativado"**; `return null` silencioso é recusado no review (padrão definido em `E00-S28`).
- **AC-F4:** Todo gate de banco novo nasce com **procedimento de abertura e de retorno** escritos no `plan.md`, antes de existir.
- **AC-F5:** O PR declara em **uma linha** o que falta para a jornada ficar utilizável em produção (flag, gate, grant) — ou afirma que já está utilizável.

## Fora de escopo

- Redesenho da UI de administração de grupos (é `E00-S10`).
- Revogação imediata de sessão — é `E00-S27`.
- Criar perfis novos de negócio sem pedido do Fabrício.
