# Feature Specification: Código público protegido, aliases e política de Equipment Auvo

**Story:** E01-S177 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S177-codigos-publicos`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-011) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Proteger identidade a partir do primeiro uso (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Editar código em rascunho; aprovar, sincronizar, etiquetar e referenciar OS em testes separados; tentar edição comum.

**Acceptance Scenarios:**

- **AC-1:** Dado rascunho nunca usado, quando ajustar código, então valida formato/unicidade e permite; aprovação, sync, etiqueta ou OS tornam edição comum proibida no servidor e UI.
- **AC-2:** Dado ativo protegido, quando renomear/mover, então UUID e código não mudam; registro legado com prova de uso é protegido sem criar novo ativo.
- **AC-3:** Dado código atual ou alias de outro ativo, quando reservar/criar, então impede colisão inclusive em concorrência e preserva códigos legados sem renumeração em massa.

### US2 — Corrigir excepcionalmente e sincronizar só onde necessário (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Administrador substitui código, reimprime etiqueta, consulta QR antigo/novo e aplica política Componente sem Equipment.

**Acceptance Scenarios:**

- **AC-4:** Dado administrador autorizado com motivo, quando substituir, então cria código substituto e alias anterior atomicamente, guarda ator/data/motivo e ambos localizam o mesmo ativo/histórico.
- **AC-5:** Dado QR repetido ou reimpressão, quando consultar, então resolve mesmo Sistema/ativo; código antigo não é apagado nem reciclado e falha de sync mostra pendência de reconciliação.
- **AC-6:** Dada política por categoria, quando sincronizar, então Sistema é Equipment Auvo, Componentes/Grupos normalmente ficam só no SO e equipamentos controlados sincronizam quando configurado; vínculos externos já existentes são preservados e não excluídos automaticamente.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Proteger identidade a partir do primeiro uso, conforme AC-1, AC-2, AC-3.
- **FR-002:** Corrigir excepcionalmente e sincronizar só onde necessário, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Código público identifica ativo com UUID estável. Código anterior vira alias após substituição administrativa e continua pesquisável. Marco de aprovação, sincronização, etiqueta ou OS protege identidade. Política de categoria decide representação Equipment Auvo.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Editar código em rascunho; aprovar, sincronizar, etiquetar e referenciar OS em testes separados; tentar edição comum.

## Assumptions & Dependencies

Requer contratos implementados de E01-S176, E01-S170. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Renumerar automático ao mover/renomear; apagar/reutilizar código anterior; excluir Equipment remoto para aplicar política; trocar rótulos de UI. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-015. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
