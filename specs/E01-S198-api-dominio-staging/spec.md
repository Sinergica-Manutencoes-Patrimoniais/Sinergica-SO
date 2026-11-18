# Feature Specification: API de domínio sobre o staging

**Story:** E01-S198 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E01-S198-api-dominio-staging`
**Status:** Especificada — implementação não iniciada. **Tier arquitetural** (integração externa). **P2.**

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 014** e seção 9.
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

O **staging existe e é robusto**: 27 migrations entre `E01-S169`, `E01-S176`, `E01-S177` e
`E01-S178` — recepção (0315), consulta (0318), conferência (0327), edição de linha (0474), fotos
(0524/0541), documentos (0554/0561), aprovação de cronograma (0485), reconciliação de legado (1077).

O que **não** existe é a **API de domínio**: hoje são cerca de 80 Edge Functions de propósito
específico, úteis, mas não um contrato. O Módulo de Campo e o MCP precisam de um caminho único,
autenticado, versionado e auditado — senão cada integração nova vira mais uma função solta, que é
exatamente a "integração paralela" que o pacote quer evitar.

Duas regras inegociáveis do pacote: **nenhuma interface externa grava diretamente na estrutura
oficial** (tudo entra por staging, com validação e auditoria) e **não haverá SQL genérico exposto**.

O pacote marca BL 014 como P2 "com desenho antecipado para evitar novas integrações paralelas" — ou
seja: **desenhar agora, implementar por etapas**.

## User Scenarios & Testing

### US1 — Um lote entra por um caminho só (Priority: P1)

**Why this priority:** É o contrato; sem ele não há Módulo de Campo nem MCP confiável.

**Independent Test:** Enviar o mesmo lote duas vezes e conferir que o segundo envio não duplica nada.

**Acceptance Scenarios:**

- **AC-1:** Dado um lote de levantamento, quando enviado pela API, então entra em **staging**, nunca no cadastro oficial.
- **AC-2:** Dado o mesmo lote reenviado com a mesma chave, quando recebido, então é **idempotente** — nenhum registro duplicado, resposta equivalente.
- **AC-3:** Dado um lote com itens inválidos, quando processado, então a resposta traz **erro por linha/item**, e os itens válidos não são perdidos nem gravados no oficial.
- **AC-4:** Dado um lote em staging, quando consultado, então existe **prévia** antes de qualquer aprovação.

### US2 — Aprovar é ato do PCM (Priority: P1)

**Why this priority:** É a fronteira entre proposta e cadastro oficial.

**Acceptance Scenarios:**

- **AC-5:** Dado um lote em staging, quando aprovado por quem tem a capacidade, então os dados passam ao cadastro oficial com **trilha de auditoria** completa.
- **AC-6:** Dado um lote **rejeitado**, quando rejeitado, então **nada** muda no cadastro oficial e o motivo fica registrado.
- **AC-7:** Dado um usuário sem a capacidade de aprovar, quando tentar aprovar, então é recusado no servidor (depende de `E00-S26`).

### US3 — A API não é um túnel para o banco (Priority: P1)

**Why this priority:** É a regra que impede a API de virar a próxima dívida de segurança.

**Acceptance Scenarios:**

- **AC-8:** Dada a superfície da API, quando auditada, então **não existe** ferramenta de SQL genérico nem consulta arbitrária.
- **AC-9:** Dada qualquer chamada, quando processada, então aplica **autenticação, autorização por capacidade, validação, idempotência e auditoria** — as cinco, não um subconjunto.
- **AC-10:** Dado um consumidor externo, quando consultar, então só alcança dados do **escopo do seu usuário** (isolamento de Cliente preservado).

### Edge Cases

- Lote grande (volume) com timeout parcial: precisa retomar sem duplicar.
- Anexo/evidência enviado antes do lote, ou lote sem o anexo prometido.
- Falha parcial: metade aprovada, metade recusada.
- Rollback de aprovação já aplicada.
- Versionamento: consumidor antigo chamando contrato novo.

## Requirements

### Functional Requirements

- **FR-001:** Definir e versionar o contrato de domínio (consultar estrutura, criar lote em staging, anexar evidência, pedir prévia, aprovar/rejeitar), conforme AC-1, AC-4, AC-5.
- **FR-002:** Garantir idempotência por chave de lote, conforme AC-2.
- **FR-003:** Retornar erro por linha/item sem gravar no oficial, conforme AC-3.
- **FR-004:** Exigir capacidade própria para aprovar, conforme AC-7.
- **FR-005:** Proibir SQL genérico e consulta arbitrária na superfície, conforme AC-8.
- **FR-006:** Aplicar autenticação, autorização, validação, idempotência e auditoria em toda rota, conforme AC-9, AC-10.
- **FR-007:** Reusar o staging existente; **não** criar um segundo mecanismo de staging.

### Key Entities

Nenhuma entidade de domínio nova. Entram **lote** (chave idempotente, estado, autor) e **contrato
versionado**. O staging de `E01-S178`/`E01-S169` é a base.

## Success Criteria

- **SC-001:** Nenhuma rota grava no cadastro oficial sem aprovação.
- **SC-002:** Reenvio do mesmo lote é comprovadamente idempotente.
- **SC-003:** Isolamento de Cliente provado por pgTAP (permitido e negado).
- **SC-004:** Guarda de CI impede rota nova sem as cinco camadas de AC-9.

## Assumptions & Dependencies

- **Depende de `E00-S26`** (capacidades) e de `E00-S27` (revogação) — a API herda a autorização, não cria a sua.
- A **Estrutura Técnica final está Em validação** no pacote: o contrato precisa tolerar a distinção Equipamento × Componente × Grupo quantitativo sem congelá-la.
- `E02-S43` (MCP) **depende desta story concluída e homologada**.
- Tier arquitetural: ADR + `/revisao-adversarial` antes do PASS.

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

- MCP (é `E02-S43`).
- Reescrever as Edge Functions existentes — elas continuam até serem absorvidas por etapas.
- Abrir a API para terceiros fora do escopo da Sinérgica.
