# Feature Specification: Deslocamento — enquadramento residencial × operacional e impacto na jornada

**Story:** E01-S195 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E01-S195-deslocamento-enquadramento`
**Status:** Especificada — implementação não iniciada.

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 009** e seção 6.
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

O que existe hoje é **declaração de tempo**, não enquadramento:
`1357_E01-S172_declaracao_deslocamento.sql` guarda `minutos_por_pessoa`, `pessoas_proprias` e
`motivo` — e nada de origem, destino ou classificação. Busca por `residenc` / `enquadrament` em
migrations e em `apps/web/src` só acerta arquivos de PMOC, sentido diferente.

A regra aprovada é jurídica antes de ser técnica:

- **Trajeto residencial — não computado:** residência → primeiro cliente; último cliente →
  residência; **inclusive quando o veículo da empresa está sob guarda do técnico**.
- **Deslocamento operacional — computado:** escritório → cliente; cliente → cliente;
  cliente → escritório; retirada ou entrega a serviço.

E três consequências que o pacote separa de propósito:

1. deslocamento computável **ocupa agenda e jornada**;
2. **não reduz automaticamente** as horas contratadas de atendimento do cliente;
3. o sistema calcula **excedente a validar** — **não** classifica hora extra sozinho.

Também: **tempo de deslocamento e despesa de deslocamento são informações diferentes** (a despesa já
tem caminho próprio em `E01-S172`/comprovantes; não misturar).

## User Scenarios & Testing

### US1 — Cada trecho tem origem, destino e enquadramento (Priority: P1)

**Why this priority:** Sem o par origem/destino não existe regra; só existe um número solto.

**Independent Test:** Declarar um dia com casa → cliente A → cliente B → casa e conferir o
computável.

**Acceptance Scenarios:**

- **AC-1:** Dado um trecho, quando registrado, então tem **origem**, **destino**, **tempo** e **enquadramento**, com origem/destino entre `residência`, `escritório`, `visita anterior`, `visita próxima` e `outro`.
- **AC-2:** Dado o trecho residência → primeiro cliente, quando enquadrado, então é **não computado** — e o resultado **não muda** se o veículo da empresa estiver sob guarda do técnico.
- **AC-3:** Dado o trecho último cliente → residência, quando enquadrado, então é **não computado**.
- **AC-4:** Dados os trechos escritório → cliente, cliente → cliente, cliente → escritório e retirada/entrega a serviço, quando enquadrados, então são **computados**.

### US2 — Computável ocupa jornada sem punir o cliente (Priority: P1)

**Why this priority:** É a distinção que o Fabrício fez questão de separar; errar aqui cobra hora que não é do cliente.

**Acceptance Scenarios:**

- **AC-5:** Dado um trecho computável, quando somado, então **ocupa agenda e jornada** do técnico.
- **AC-6:** Dado o mesmo trecho, quando a Visita for medida, então as **horas contratadas do cliente não são reduzidas automaticamente**.
- **AC-7:** Dada uma jornada acima do limite, quando calculada, então o sistema apresenta **excedente a validar**, **sem** classificar como hora extra.

### US3 — O PCM continua dono do plano (Priority: P2)

**Why this priority:** O pacote é explícito: alerta não bloqueia a rotina.

**Acceptance Scenarios:**

- **AC-8:** Dado o deslocamento sugerido por cliente, quando o PCM editar na Visita, então o valor editado prevalece e a sugestão fica registrada como origem.
- **AC-9:** Dado um alerta de capacidade, conflito, ausência, especialidade, certificação ou perfil do cliente, quando disparado, então **não bloqueia** o planejamento; o PCM **registra ciência** e segue.
- **AC-10:** Dado o deslocamento, quando o planejamento ocorrer, então ele é **opcional** — Visita sem deslocamento declarado é válida.

### Edge Cases

- Dia que começa no escritório e termina na residência (primeiro trecho computa, último não).
- Visita única no dia: casa → cliente → casa, zero computável.
- Retirada de material no caminho de casa para o cliente: a retirada a serviço computa, o resto do trajeto residencial não.
- Equipe com mais de um técnico, cada um saindo de lugar diferente.
- Trecho editado depois da Visita concluída: precisa de revisão/versionamento, como o resto de `E01-S172`.

## Requirements

### Functional Requirements

- **FR-001:** Registrar trecho com origem, destino, tempo e enquadramento, conforme AC-1.
- **FR-002:** Aplicar a regra residencial × operacional, inclusive com veículo sob guarda, conforme AC-2, AC-3, AC-4.
- **FR-003:** Somar computável em agenda e jornada sem reduzir horas contratadas, conforme AC-5, AC-6.
- **FR-004:** Calcular excedente a validar sem classificar hora extra, conforme AC-7.
- **FR-005:** Manter deslocamento opcional, editável e com alerta não bloqueante, conforme AC-8, AC-9, AC-10.
- **FR-006:** Manter **tempo** e **despesa** de deslocamento como informações separadas.

### Key Entities

**Trecho de deslocamento** vinculado à Visita (origem, destino, tempo, enquadramento, autor,
revisão). Alarga o caminho de `1357`–`1359` de forma **aditiva**; migration aplicada não é editada.

## Success Criteria

- **SC-001:** pgTAP cobre **todos** os pares origem × destino, ida e volta.
- **SC-002:** Nenhum caso reduz hora contratada do cliente automaticamente.
- **SC-003:** Nenhum caso classifica hora extra automaticamente.
- **SC-004:** Alerta de capacidade nunca impede salvar o plano.

## Assumptions & Dependencies

- Depende de **BL 003** (Visita como contêiner) — já existe em `E01-S171`.
- Depende do cadastro de técnicos e clientes.
- Sem integração externa obrigatória nesta etapa.

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

- Cálculo de rota, distância ou GPS (existe `pcm-auvo-gps-pull`, mas não é fonte de enquadramento aqui).
- Política de hora extra e folha.
- Despesa de deslocamento (caminho próprio já existente).
