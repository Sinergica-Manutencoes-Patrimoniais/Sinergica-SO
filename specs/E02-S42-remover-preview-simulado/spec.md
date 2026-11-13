# Feature Specification: Retirar a rota de prévia simulada do build de produção

**Story:** E02-S42 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-13
**Feature Branch (planejada):** `fix/E02-S42-preview-simulado`
**Status:** Especificada — implementação não iniciada. Story pequena; cabe no fluxo de bug (branch → teste que falha → fix → PR).

**Input:** Reanálise do Fabrício de 12/11/2026, pergunta 24.

## Contexto — o problema que esta story resolve

A rota `/preview-s41`, criada no porte da Evolution (E02-S41) como prévia visual com **dados
simulados**, está no bundle servido em produção. Confirmado em 13/11/2026: a string
`preview-s41` aparece no JavaScript entregue por `so-sinergica.netlify.app`.

O risco não é a rota existir — é alguém abri-la e tomar dado simulado por dado real. Numa
demonstração ao cliente, isso custa a confiança no resto do sistema.

## User Scenarios & Testing

### US1 — Prévia simulada não chega à produção (Priority: P1)

**Why this priority:** Dado falso indistinguível de real num ambiente de produção é risco de credibilidade.

**Independent Test:** Construir com a configuração de produção e confirmar que a rota não responde e o código não está no bundle; construir em desenvolvimento e confirmar que continua disponível.

**Acceptance Scenarios:**

- **AC-1:** Dado um build com a configuração de produção, quando a rota de prévia for acessada, então ela não existe — e o código dela **não está no bundle**, não basta estar inacessível.
- **AC-2:** Dado um build de desenvolvimento ou de prévia do Netlify, quando a rota for acessada, então ela continua disponível para o trabalho em andamento do porte Evolution.
- **AC-3:** Dada qualquer tela que exiba dado simulado em qualquer ambiente, quando carregada, então diz isso de forma visível e permanente — rótulo que não depende de rolagem para aparecer.

### Edge Cases

- Outras rotas de prévia ou demonstração que possam existir pelo mesmo motivo: varrer antes de fechar.
- A prévia é trabalho em curso de outra story; retirá-la da produção não pode travar o desenvolvimento dela.

## Requirements

### Functional Requirements

- **FR-001:** Excluir a rota de prévia do bundle de produção por configuração de build, conforme AC-1, AC-2.
- **FR-002:** Rotular visivelmente toda superfície com dado simulado, conforme AC-3.
- **FR-003:** Impedir reincidência — verificação automática que falhe se uma rota marcada como prévia entrar num build de produção.

### Key Entities

Nenhuma.

## Success Criteria

- **SC-001:** O bundle de produção não contém a rota de prévia nem seus dados simulados.
- **SC-002:** O desenvolvimento do porte Evolution continua com a prévia disponível.
- **SC-003:** A verificação de FR-003 falha quando alguém reintroduz o padrão.

## Assumptions & Dependencies

- Pertence ao épico E02 (Atendimento/Evolution); coordenar com quem conduz E02-S35 a S41 antes de mexer.
- Sem dependência de banco, gate ou credencial.

## Fora de escopo

- Implementar a tela definitiva de Atendimento que a prévia antecipa.
- Revisar o restante do porte Evolution.
