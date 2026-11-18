# Feature Specification: Ativação visível no front — flag declarada e recurso que se anuncia

**Story:** E00-S28 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E00-S28-ativacao-visivel-no-front`
**Status:** Especificada — implementação não iniciada.

**Input:** Observação do Lucas em 17/11/2026 ("regra de negócio feita mas não disponível no front —
não consigo criar uma segunda OS num Chamado"). Medição em
`docs/Apontamentos/alcance-no-front-2026-11-17.md`.

## Contexto — o problema que esta story resolve

A medição é objetiva:

- **737** flags `VITE_SSO_*` usadas em **434** arquivos do front;
- **43** declaradas em `.env.example`, `netlify.toml` ou `.env.local`;
- **694 usadas e nunca declaradas em lugar nenhum**;
- **227** pontos do front que, com a flag ausente, fazem `return null` **silencioso**;
- **583** gates de banco `default false`, contra **1** migration que já abriu algum.

O caso que o Lucas tentou é o retrato: a regra de **Chamado 1:N OS** está fechada em produção
(`1842`), a UI existe e está fiada (`ChamadoPainel.tsx:244` → adapter → `sso_criar_os_chamado_autorizado`),
e mesmo assim não há botão — porque `VITE_SSO_CRIAR_OS_CHAMADO_ENABLED` nunca foi declarada e
`CriarOsChamado.tsx:19` faz `if (props.habilitado !== "true") return null`.

O efeito mais caro não é o recurso desligado: é **não dar para distinguir "não foi feito" de "foi
feito e está desligado"**. Toda auditoria de escopo e toda conversa com o cliente parte de uma tela
que mente por omissão.

Esta story **não abre gate nenhum** e **não acende funcionalidade**. Ela faz com que desligado seja
**declarado, detectável e explicável**. É o par de `E01-S188`: lá é o diagnóstico do servidor, aqui
é a honestidade da tela e a trava no build.

## User Scenarios & Testing

### US1 — Flag não declarada quebra o build (Priority: P1)

**Why this priority:** É o que para o sangramento; sem isso, cada story nova repõe o problema.

**Independent Test:** Introduzir num componente uma flag `VITE_SSO_*` inexistente e rodar o CI.

**Acceptance Scenarios:**

- **AC-1:** Dada uma flag `VITE_SSO_*` lida no código e **não declarada** em nenhum arquivo de ambiente versionado, quando o CI rodar, então **falha** nomeando a flag e o arquivo que a lê.
- **AC-2:** Dada uma flag declarada e **não lida** por nenhum código, quando o CI rodar, então reporta como órfã — declaração morta também é ruído.
- **AC-3:** Dado o inventário atual de **694** flags não declaradas, quando esta story for concluída, então todas estão declaradas com valor explícito (`false` quando a decisão é continuar desligada) — o gate não nasce com exceção aberta.

### US2 — Recurso desligado se anuncia em vez de sumir (Priority: P1)

**Why this priority:** É a causa direta da percepção de "não existe no sistema".

**Independent Test:** Abrir o painel do Chamado com a flag desligada e confirmar que há um estado
visível explicando, em vez de nada.

**Acceptance Scenarios:**

- **AC-4:** Dado um recurso desligado por flag, quando a tela renderizar, então mostra um estado explícito — "disponível, não ativado" — em vez de **retornar `null` silenciosamente**.
- **AC-5:** Dado um usuário com papel de administração, quando vir esse estado, então ele nomeia **o que falta** (flag, gate ou grant) e aponta o procedimento de ativação.
- **AC-6:** Dado um operador sem papel de administração, quando vir esse estado, então vê que o recurso existe e está indisponível, **sem** expor nome de flag, gate ou estrutura interna.
- **AC-7:** Dado um recurso **recusado pelo servidor** (`42501` de grant ou `55000` de gate), quando o erro chegar na tela, então a mensagem distingue **falta de permissão** de **recurso não ativado** — hoje os dois viram o mesmo erro genérico.

### US3 — Dá para perguntar "o que está desligado?" (Priority: P2)

**Why this priority:** Fecha o ciclo com `E01-S188`, que declara e diagnostica pelo lado do servidor.

**Acceptance Scenarios:**

- **AC-8:** Dado o inventário, quando consultado, então lista cada flag com: quem a lê, qual gate de banco corresponde, qual jornada depende dela e o estado no **build publicado**.
- **AC-9:** Dada uma flag ligada no Netlify sem republicação, quando inventariada, então aparece como **divergente** entre declarado e servido (mesmo critério do AC-6 de `E01-S188`, visto pelo front).

### Edge Cases

- Flag montada dinamicamente (`VITE_SSO_${x}`): o gate precisa detectar e recusar a construção dinâmica, senão vira caminho de fuga.
- Flag usada só em teste ou em código morto.
- Recurso que depende de **duas** flags, ou de flag + gate: o estado precisa dizer o conjunto, não o primeiro item que falhou.
- Portal do cliente: o estado "não ativado" **não** pode vazar nome interno para o síndico.

## Requirements

### Functional Requirements

- **FR-001:** Gate de CI para flag lida e não declarada, e relatório de flag órfã, conforme AC-1, AC-2.
- **FR-002:** Declarar as 694 flags pendentes com valor explícito, conforme AC-3.
- **FR-003:** Substituir o `return null` silencioso por estado de indisponibilidade, conforme AC-4.
- **FR-004:** Diferenciar a mensagem por papel, sem vazar estrutura interna, conforme AC-5, AC-6.
- **FR-005:** Distinguir, na borda, recusa por permissão de recusa por gate, conforme AC-7.
- **FR-006:** Publicar o inventário flag × leitor × gate × jornada × estado servido, conforme AC-8, AC-9.

### Key Entities

Nenhuma entidade de banco nova. Entra um **inventário de ativação do front** (arquivo versionado,
verificado pelo CI) e um componente compartilhado de **estado de indisponibilidade** em `packages/`.

## Success Criteria

- **SC-001:** Zero flag `VITE_SSO_*` lida e não declarada — verificado por comando no CI, não por inspeção.
- **SC-002:** Zero `return null` silencioso atrás de flag nos caminhos de ação do PCM.
- **SC-003:** Dada uma funcionalidade desligada, um administrador descobre o que falta **sem abrir o código**.
- **SC-004:** Nenhuma mensagem de indisponibilidade expõe nome de flag ou gate a perfil não administrativo.

## Assumptions & Dependencies

- Complementar a `E01-S188` (diagnóstico do servidor): esta é a metade do front. Podem andar em paralelo; o inventário do AC-8 consome o registro de jornadas da S188 quando ele existir.
- Não depende de credencial externa e **não abre nenhum gate**.
- Toca 434 arquivos: fazer em lotes por domínio, não num PR único.

## Fora de escopo

- Abrir gate ou ligar flag em produção — é decisão de operação (ver `E01-S188` e o item 6 de `docs/Apontamentos/alcance-no-front-2026-11-17.md`).
- Remover o mecanismo de flags ou de gates.
- Redesenho visual das telas afetadas.
