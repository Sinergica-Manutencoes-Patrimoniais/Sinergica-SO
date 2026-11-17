# Feature Specification: MCP controlado sobre a API de domínio

**Story:** E02-S43 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E02-S43-mcp-controlado`
**Status:** Especificada — **bloqueada por dependência** (`E01-S198` concluída e homologada). **P2.**

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 015** e seção 9.
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

Não existe camada conversacional oficial: nenhuma Edge Function de MCP em `supabase/functions`, e
`E02-S30` ficou em design desde 2026-08-07.

A regra do pacote é restritiva de propósito: o MCP **expõe ferramentas controladas** para ChatGPT,
Claude ou outra IA e **usa a API de domínio — não acessa o banco diretamente**. **Ferramentas
genéricas de SQL não serão expostas.** A primeira entrega é **leitura**; escrita vem depois e
**apenas em staging**, com confirmação. Toda ação **herda usuário, escopo, permissões e auditoria**.

## User Scenarios & Testing

### US1 — Leitura primeiro, sem cruzar escopo (Priority: P1)

**Why this priority:** É a entrega 1 definida pelo pacote; e é onde vaza dado se estiver errada.

**Acceptance Scenarios:**

- **AC-1:** Dada uma ferramenta de consulta, quando chamada, então devolve **apenas** dados do escopo do usuário autenticado — nunca de outro cliente.
- **AC-2:** Dada qualquer ferramenta, quando executada, então passa **pela API de domínio**; nenhum acesso direto ao banco.
- **AC-3:** Dada a superfície de ferramentas, quando auditada, então **não há** ferramenta de SQL genérico.

### US2 — Escrita só em staging, e com confirmação (Priority: P1)

**Why this priority:** É a fronteira que separa assistente de risco operacional.

**Acceptance Scenarios:**

- **AC-4:** Dada uma ferramenta de escrita, quando usada, então cria **lote provisório em staging** e **nunca** grava no cadastro oficial.
- **AC-5:** Dada uma escrita proposta, quando criada, então exige **confirmação explícita** antes de ser persistida como proposta.
- **AC-6:** Dado o registro da ação, quando consultado, então identifica **usuário e ferramenta** usados.

### US3 — Entrada hostil não vira poder (Priority: P1)

**Why this priority:** O consumidor é um modelo de linguagem; a entrada é adversarial por natureza.

**Acceptance Scenarios:**

- **AC-7:** Dado um prompt malicioso tentando alargar escopo, quando processado, então a autorização do **servidor** decide — texto não concede capacidade.
- **AC-8:** Dada uma ferramenta não autorizada para aquele usuário, quando chamada, então é recusada e o evento é registrado.
- **AC-9:** Dado um acesso revogado, quando a próxima chamada chegar, então é negada **imediatamente** (depende de `E00-S27`).
- **AC-10:** Dada uma chamada repetida, quando idempotente, então não duplica efeito.

### Edge Cases

- Falha parcial no meio de um lote proposto pela IA.
- Ferramenta que o modelo chama com argumento fora do domínio.
- Volume: muitas chamadas em sequência pelo mesmo agente.
- Conteúdo de documento importado contendo instrução (tratar como dado, nunca como instrução).

## Requirements

### Functional Requirements

- **FR-001:** Expor ferramentas específicas e nominadas, sobre a API de domínio, conforme AC-2, AC-3.
- **FR-002:** Entregar primeiro **somente leitura**, com isolamento de Cliente, conforme AC-1.
- **FR-003:** Permitir escrita posterior **apenas em staging**, com confirmação, conforme AC-4, AC-5.
- **FR-004:** Herdar usuário, escopo, permissões e auditoria do SSO, conforme AC-6, AC-8.
- **FR-005:** Respeitar revogação imediata, conforme AC-9.
- **FR-006:** Garantir idempotência por chamada, conforme AC-10.

### Key Entities

Nenhuma entidade de domínio nova. Entram **ferramenta MCP** (catálogo, capacidade exigida) e
**registro de uso** append-only.

## Success Criteria

- **SC-001:** Isolamento por cliente provado, inclusive sob prompt adversarial.
- **SC-002:** Nenhuma escrita oficial alcançável pelo MCP.
- **SC-003:** Logs identificam usuário e ferramenta em 100% das chamadas.
- **SC-004:** Revogação derruba o acesso na chamada seguinte.

## Assumptions & Dependencies

- **Bloqueada:** exige `E01-S198` **concluída e homologada**.
- Depende de `E00-S26` e `E00-S27`.
- Substitui o design parado de `E02-S30` (que fica como registro histórico).
- Tier arquitetural: ADR + `/revisao-adversarial` antes do PASS.

## Fora de escopo

- Expor o MCP fora da operação da Sinérgica.
- Escrita direta no cadastro oficial, em qualquer hipótese.
- Escolha de modelo/provedor de IA.
