# Feature Specification: Dar alcance aos sete escritores sem gate

**Story:** E01-S189 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-13
**Feature Branch (planejada):** `feat/E01-S189-escritores-sem-gate`
**Status:** Especificada — implementação não iniciada.

**Input:** Conferência do Caderno (SSO-015, SSO-016, SSO-017) e reanálise do Fabrício de 12/11/2026.

## Contexto — o problema que esta story resolve

Sete funções estão implementadas, testadas e **inalcançáveis**. Confirmado em 13/11/2026: nenhuma
tem `execute` para `authenticated`.

| Função | Jornada do Caderno |
|---|---|
| `comercial.sso_criar_orcamento_operacional` | SSO-015 — orçamento a partir de lista de materiais |
| `pcm.sso_declarar_repasse_despesa` | SSO-016 — despesa repassável da Visita |
| `pcm.sso_ratear_despesa_visita` | SSO-016 — rateio opcional por OS |
| `pcm.sso_alterar_previsao_visita` | SSO-016 — previsão de despesa na Visita |
| `financeiro.sso_publicar_cobranca_os` | SSO-017 — documento de cobrança |
| `pcm.sso_criar_grupo_atomico` | estrutura — grupo quantitativo |
| `pcm.sso_editar_grupo_idempotente` | estrutura — edição do grupo |

Elas ficaram sem grant **de propósito**: diferente das outras 272 que receberam grant na migration
1839, estas **escrevem sem gate de banco**. Dar `execute` a elas é liberar a ação direto, sem
interruptor para fechar depois.

O efeito prático para quem usa: a ação existe na tela, o usuário clica e recebe
`permission denied` — um erro que parece bug e não é. É exatamente o "gap de feature não
disponível para uso" que o Fabrício aponta.

## User Scenarios & Testing

### US1 — Cada escritor ganha seu próprio interruptor (Priority: P1)

**Why this priority:** É o que permite dar alcance sem perder o controle de desligar.

**Independent Test:** Com o gate fechado, a ação é recusada com erro nomeado; aberto, executa; fechada de novo, volta a recusar — sem reiniciar nada.

**Acceptance Scenarios:**

- **AC-1:** Dada cada uma das sete funções, quando um usuário autorizado chamar com o gate fechado, então recebe recusa com código e motivo **nomeados para aquela ação** — nunca `permission denied` genérico.
- **AC-2:** Dado o gate aberto e o usuário com a concessão correta para o Cliente, quando chamar, então a ação executa e o efeito é idempotente por `request_id`: repetir devolve o mesmo recibo, não duplica.
- **AC-3:** Dado o gate aberto e um usuário **sem** a concessão correta, ou com Cliente divergente, então a ação é recusada — abrir o gate libera a funcionalidade, nunca a autorização.

### US2 — A tela explica o que está acontecendo (Priority: P2)

**Why this priority:** Erro ilegível na tela é a origem do diagnóstico errado — hoje parece bug.

**Independent Test:** Com o gate fechado, abrir a tela da ação e confirmar que ela diz que a ação está indisponível, em vez de deixar o usuário clicar e falhar.

**Acceptance Scenarios:**

- **AC-4:** Dada uma ação cujo gate está fechado, quando a tela carregar, então o controle aparece desabilitado com a explicação de que depende de liberação, em vez de habilitado e quebrando no clique.
- **AC-5:** Dada uma falha de autorização real — usuário sem concessão —, quando ocorrer, então a mensagem distingue "você não tem permissão" de "a função não está liberada", porque a ação de correção é diferente em cada caso.

### Edge Cases

- Função que já era alcançável por outro caminho mediado: o gate novo não pode fechar o caminho existente sem aviso.
- Gate aberto com o grant ainda ausente: a chamada tem que recusar com o erro de ativação, não com `42501` cru.
- Duas das sete pertencem à mesma jornada (despesa): fechar uma não pode deixar a Visita num meio-termo em que prever é possível e ratear não.

## Requirements

### Functional Requirements

- **FR-001:** Criar gate próprio por função, fechado por padrão, e um mediador que o consulte antes do núcleo, conforme AC-1, AC-2, AC-3.
- **FR-002:** Conceder `execute` **ao mediador**, mantendo o núcleo revogado de todos os papéis.
- **FR-003:** Declarar cada gate no registro de ativação de E01-S188, com motivo e retorno.
- **FR-004:** Refletir indisponibilidade na interface antes do clique, conforme AC-4, AC-5.

### Key Entities

Sem entidade nova. Reusa o padrão de mediador já estabelecido: núcleo revogado, mediador com gate,
grant só no mediador.

## Success Criteria

- **SC-001:** As sete ações passam a ser executáveis em ambiente de teste com o gate aberto, e recusadas com motivo legível com ele fechado.
- **SC-002:** Nenhuma das sete fica alcançável sem gate — o estado "liberado sem interruptor" não existe ao fim desta story.
- **SC-003:** O diagnóstico de E01-S188 responde corretamente sobre cada uma delas.

## Assumptions & Dependencies

- Depende de E01-S188 para o registro de ativação (FR-003). O resto pode ser feito antes.
- Não depende de credencial externa nem de decisão de navegação.

## Fora de escopo

- Abrir qualquer um dos sete gates em produção.
- Rever a regra de negócio das funções — elas já têm pgTAP e não estão em questão aqui; o que falta é alcance.
