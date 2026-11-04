# Feature Specification: E01-S182 — Fila A Faturar por origem única

**Feature Branch**: `codex/handoff-plano-manutencao`
**Created**: 2026-10-26
**Status**: Especificada — implementação não iniciada
**Input**: Caderno Técnico de Implementação SSO v1, SSO-017, e definições do Fabrício de 26/10/2026.
**Dependências**: E01-S180, E01-S181, E01-S167 (encerramento/escopo) e E01-S171 (Visita).

## User Scenarios & Testing

### User Story 1 — Receber origem faturável uma vez (Priority: P1)

Cada fato operacional aparece uma vez na fila de conferência.

**Why this priority**: Entrega o primeiro fluxo verificável da story.
**Independent Test**: Reprocessar e concorrer dez vezes sobre o mesmo fornecimento.

**Acceptance Scenarios**:

1. **AC-1** — **Given** OS extra, material fornecido, despesa repassável, Visita extra ou outro evento configurado, **When** liberar fato elegível para conferência, **Then** item mostra Cliente, origem, valor, competência, vínculo operacional e situação, sem cobrar automaticamente nem confundir despesa com material.
2. **AC-2** — **Given** evento ou pedido repetido inclusive concorrente, **When** reprocessar mesma origem, **Then** há um único item base e nenhuma cobrança ou recebível adicional; nova carga diferente para origem existente é divergência explícita, sem substituir valor.

### User Story 2 — Conferir e efetivar documento (Priority: P1)

Financeiro controla valor e vínculo com cobrança.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Conferir e faturar item com documento; repetir pedido.

**Acceptance Scenarios**:

1. **AC-3** — **Given** item pendente e usuário Financeiro autorizado, **When** conferir e ajustar valor dentro da permissão, **Then** ajuste exige motivo, registra original e final, responsável/data e competência, preservando referência ao orçamento/dispensa e regra contratual.
2. **AC-4** — **Given** item conferido e documento informado, **When** efetivar faturamento inclusive parcial com distribuição explícita, **Then** documento, data e parcelas ficam vinculados; soma faturada não ultrapassa saldo, cada parcela tem identidade e repetição retorna mesmo resultado, sem recebível duplicado.

### User Story 3 — Cancelar, complementar e estornar (Priority: P2)

Correções não apagam efeito financeiro nem criam dupla cobrança.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Cancelar antes e estornar depois; adicionar complemento com referência.

**Acceptance Scenarios**:

1. **AC-5** — **Given** item ainda não faturado ou item já faturado, **When** solicitar cancelamento ou estorno, **Then** pendente pode cancelar com motivo; faturado exige estorno explícito vinculado ao documento/lançamento, preservando histórico e respeitando competência fechada.
2. **AC-6** — **Given** mesma origem precisando novo valor, **When** criar complemento autorizado, **Then** nova identidade de complemento referencia item anterior com motivo e valor próprio; nenhum valor aprovado/faturado é substituído silenciosamente e saldo líquido considera estornos.

### Edge Cases

- Repetição e concorrência não duplicam objetos nem substituem decisões; edição obsoleta apresenta conflito explícito.
- Mudança de Conta ou revogação de usuário não mantém acesso por cache, URL direta ou anexo.
- Registro histórico incompleto permanece identificável; não completar valores ou decisões por inferência.

## Requirements

### Functional Requirements

- **FR-001**: Chave única base por Cliente + tipo de origem + ID estável do fato; número de versão técnica não permite cobrar de novo.
- **FR-002**: Origem deve ser fato granular: fornecimento/lote entregue, parcela de serviço ou despesa autorizada, não somente ID genérico de OS.
- **FR-003**: Recebíveis e cobrança usam Financeiro existente; item A Faturar não é lançamento realizado nem cobrança automaticamente.
- **FR-004**: Cancelamento e estorno são transições diferentes; bloqueios de competência fechada existentes prevalecem.
- **FR-005**: Complementos têm identidade explícita e relação com item base; evento repetido não cria complemento.
- **FR-006**: Totais em centavos; rateios e faturamentos parciais conservam saldo e nunca somam o mesmo fato por caminhos OS/Visita/material.

### Key Entities

Item faturável; origem operacional única; conferência; documento; alocação parcial; vínculo recebível; complemento; estorno.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos seis cenários de aceite são demonstráveis em ambiente de teste com autoria e vínculos recuperáveis.
- **SC-002**: Dez reenvios simultâneos do mesmo pedido não geram duplicidade ou decisão adicional.
- **SC-003**: Nenhuma consulta ou ação sem autorização revela dados privados de outra Conta.

## Assumptions

- Reutilizar capacidades existentes indicadas em research.md; Componentes e Sistemas mantêm nomes de UI e cadastros.
- Decisões do Fabrício prevalecem; sem nova dúvida funcional bloqueadora. Contratos técnicos são verificados antes da liberação correspondente.
- Operação produz candidatos faturáveis rastreáveis; Financeiro confere, efetiva e corrige por complemento/estorno, com unicidade por origem.
- Catálogo do caderno: CT-026; evidência deve informar versão, ambiente, executor, data e ressalvas.

## Fora de escopo

Emissão fiscal automática, novo gateway de pagamento, nova contabilidade ou cobrança externa real. Nesta etapa, somente especificação; nenhuma migration aplicada, deploy, cobrança ou tarefa Auvo real.

