# Feature Specification: E01-S180 — Despesas previstas e realizadas por Visita

**Feature Branch**: `codex/handoff-plano-manutencao`
**Created**: 2026-10-26
**Status**: Especificada — implementação não iniciada
**Input**: Caderno Técnico de Implementação SSO v1, SSO-016, e definições do Fabrício de 26/10/2026.
**Dependências**: E01-S171 (Visita) e E01-S170 (autorização).

## User Scenarios & Testing

### User Story 1 — Registrar despesa oficial da Visita (Priority: P1)

PCM acompanha previsto e realizado sem depender do espelho Auvo.

**Why this priority**: Entrega o primeiro fluxo verificável da story.
**Independent Test**: Criar previsão, registrar realizado com comprovante e reenviar o mesmo comando.

**Acceptance Scenarios**:

1. **AC-1** — **Given** Visita existente e PCM autorizado, **When** registrar previsão e depois realização com comprovante, **Then** uma despesa conserva ambos os valores, categoria, data, responsável e Visita; relatórios usam realizado quando informado, sem somar previsão como gasto adicional.
2. **AC-2** — **Given** mesmo pedido repetido ou duas gravações concorrentes, **When** confirmar realização, **Then** há um único lançamento da despesa e comprovantes protegidos; um conflito de edição exige recarga, sem sobrescrever silenciosamente.

### User Story 2 — Ratear e distinguir aquisição (Priority: P1)

Relatórios mostram custo correto por OS e Cliente.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Ratear R$100 entre duas OS e comparar total por Visita.

**Acceptance Scenarios**:

1. **AC-3** — **Given** despesa de R$100 e duas OS vigentes da mesma Visita e Cliente, **When** ratear R$60 e R$40, **Then** total da despesa permanece R$100 e os relatórios por OS exibem parcelas sem duplicação; rateio ausente é permitido e rateio parcial ou acima de R$100 é recusado.
2. **AC-4** — **Given** retirada exclusiva de material e despesa compartilhada de atendimento, **When** classificar custos, **Then** retirada exclusiva pertence à aquisição, material não vira despesa de Visita; custos operacionais compartilhados permanecem na Visita, sem dupla apropriação.

### User Story 3 — Cancelar com histórico e controlar acesso (Priority: P2)

Cancelamentos e integração financeira permanecem auditáveis.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Cancelar registro não contabilizado e tentar alteração por cliente.

**Acceptance Scenarios**:

1. **AC-5** — **Given** despesa ainda não efetivada no Financeiro, **When** cancelar com motivo, **Then** histórico e comprovantes permanecem e relatórios excluem o cancelado; se já efetivada, sistema exige fluxo financeiro de estorno em vez de apagar.
2. **AC-6** — **Given** cliente ou usuário sem permissão e outro com permissão, **When** acessar valor, comprovante ou registrar despesa, **Then** primeiro recebe acesso negado inclusive por acesso direto; segundo opera somente no escopo permitido e gera auditoria; técnico não registra despesas no SSO nesta etapa.

### Edge Cases

- Repetição e concorrência não duplicam objetos nem substituem decisões; edição obsoleta apresenta conflito explícito.
- Mudança de Conta ou revogação de usuário não mantém acesso por cache, URL direta ou anexo.
- Registro histórico incompleto permanece identificável; não completar valores ou decisões por inferência.

## Requirements

### Functional Requirements

- **FR-001**: Manter despesa oficial distinta de pcm.despesas, que hoje espelha Auvo e exige auvo_id; importar legado só com conciliação de origem.
- **FR-002**: Valores previstos e realizados são inteiros em centavos não negativos; ausência de realizado difere de zero realizado.
- **FR-003**: Rateio opcional: quando fornecido deve totalizar exatamente realizado (ou previsto, antes da realização), com arredondamento determinístico e OS da mesma Visita/Cliente.
- **FR-004**: Comprovantes permanecem privados; links temporários autorizados, sem compartilhamento automático no Portal.
- **FR-005**: Repasses geram somente evento candidato a item faturável na E01-S182; registrar despesa não cobra cliente.
- **FR-006**: Relatórios por Cliente, técnico e período agregam a despesa uma vez; previsão e realizado são eixos distintos.

### Key Entities

Despesa de Visita; valores previsto/realizado; comprovante privado; rateio por OS; evento de cancelamento/estorno; vínculo de origem Auvo opcional.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos seis cenários de aceite são demonstráveis em ambiente de teste com autoria e vínculos recuperáveis.
- **SC-002**: Dez reenvios simultâneos do mesmo pedido não geram duplicidade ou decisão adicional.
- **SC-003**: Nenhuma consulta ou ação sem autorização revela dados privados de outra Conta.

## Assumptions

- Reutilizar capacidades existentes indicadas em research.md; Componentes e Sistemas mantêm nomes de UI e cadastros.
- Decisões do Fabrício prevalecem; sem nova dúvida funcional bloqueadora. Contratos técnicos são verificados antes da liberação correspondente.
- PCM registra despesas previstas e realizadas na Visita; rateio por OS é opcional e não multiplica despesa nem cobrança.
- Catálogo do caderno: CT-027 (segurança transversal); evidência deve informar versão, ambiente, executor, data e ressalvas.

## Fora de escopo

Compras e listas (E01-S179); cobrança/efetivação financeira (E01-S182); perfil técnico no SSO. Nesta etapa, somente especificação; nenhuma migration aplicada, deploy, cobrança ou tarefa Auvo real.

