# Feature Specification: E01-S181 — Orçamento operacional canônico no Comercial

**Feature Branch**: `codex/handoff-plano-manutencao`
**Created**: 2026-10-26
**Status**: Especificada — implementação não iniciada
**Input**: Caderno Técnico de Implementação SSO v1, SSO-015, e definições do Fabrício de 26/10/2026.
**Dependências**: E01-S179 (materiais), E01-S170 (autorização) e E01-S184 (proteção de custos).

## User Scenarios & Testing

### User Story 1 — Formar preço de fornecimento com custos protegidos (Priority: P1)

Sinérgica vende fornecimento com preço revisável e composição interna.

**Why this priority**: Entrega o primeiro fluxo verificável da story.
**Independent Test**: Custo R$100 gera sugestão R$150 e cliente recebe somente descrição/preço autorizados.

**Acceptance Scenarios**:

1. **AC-1** — **Given** lista com aquisição pela Sinérgica e custo de R$100, **When** preparar orçamento com fator padrão 1,50 e sem custos adicionais, **Then** sugestão é R$150; custos operacionais adicionais podem compor preço, fator é editável por permissão, e nota, custo e margem permanecem internos.
2. **AC-2** — **Given** preço baixo em relação ao custo ou desconto, **When** solicitar envio, **Then** permissões e política de piso existentes são verificadas no servidor; exceção exige autorização e motivo auditados, sem divulgar composição interna ao Cliente.

### User Story 2 — Versionar decisão ou dispensar documento (Priority: P1)

Trabalho prossegue conforme política do Cliente sem alterar o que foi aprovado.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Enviar, aprovar e complementar proposta; dispensar outra com motivo.

**Acceptance Scenarios**:

1. **AC-3** — **Given** orçamento rascunho vinculado a OS/lista, **When** enviar e receber aprovação ou recusa, **Then** versão enviada fica congelada, decisão registra versão, data e autor; recusado preserva motivo e expirado exige revalidação registrada ou nova versão antes de seguir.
2. **AC-4** — **Given** orçamento aprovado ou regra contratual dispensando documento, **When** alterar preço/escopo ou dispensar, **Then** aprovado exige nova versão ou complemento explícito; dispensa registra motivo ou regra vigente e responsável, não significa valor zero nem elimina eventual item faturável.

### User Story 3 — Unificar fonte e compatibilizar legado (Priority: P2)

Mesma negociação não cria propostas, OS ou cobranças concorrentes.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Decidir orçamento legado duas vezes e emitir novo pela OS existente.

**Acceptance Scenarios**:

1. **AC-5** — **Given** orçamento histórico em pcm.orcamentos_servico e proposta nova, **When** abrir fluxo operacional, **Then** legado permanece legível com ID e decisões preservados; novas emissões usam uma fonte canônica, vinculam OS/lista/Cliente e não criam terceiro cadastro concorrente.
2. **AC-6** — **Given** orçamento vinculado a OS existente ou decisão repetida, **When** aprovar por Portal ou PCM autorizado, **Then** decisão é idempotente e conserva a mesma OS; comportamento legado de criar OS só ocorre para requisição pré-OS sem vínculo, uma vez, com rastreabilidade.

### Edge Cases

- Repetição e concorrência não duplicam objetos nem substituem decisões; edição obsoleta apresenta conflito explícito.
- Mudança de Conta ou revogação de usuário não mantém acesso por cache, URL direta ou anexo.
- Registro histórico incompleto permanece identificável; não completar valores ou decisões por inferência.

## Requirements

### Functional Requirements

- **FR-001**: Orçamento operacional usa o modelo versionado do Comercial e referencia OS, lista e Cliente pelo contrato compartilhado; não criar nova entidade de proposta no PCM.
- **FR-002**: Financeiro.orcamentos é meta mensal por categoria e não participa da negociação com Cliente.
- **FR-003**: Estados de negócio incluem rascunho, enviado, aprovado, recusado, expirado e dispensado; mapear aceito do Comercial para aprovado na apresentação sem romper estados legados.
- **FR-004**: Custos de aquisição multiplicados por fator sugerido 1,50; custos de retirada exclusiva/veículo/administração entram uma vez. Arredondar preço final em centavos.
- **FR-005**: Somente descrição autorizada e preço de venda compõem snapshot público; complementos referenciam versão/origem anterior.
- **FR-006**: Não migrar ou reemitir orçamento histórico cegamente; mapa de correspondência por ID e classificação pré-OS/OS existente é obrigatório.

### Key Entities

Proposta Comercial e versões; vínculo operacional OS/lista; composição interna; snapshot público; decisão versionada; dispensa; complemento; correspondência de legado.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos seis cenários de aceite são demonstráveis em ambiente de teste com autoria e vínculos recuperáveis.
- **SC-002**: Dez reenvios simultâneos do mesmo pedido não geram duplicidade ou decisão adicional.
- **SC-003**: Nenhuma consulta ou ação sem autorização revela dados privados de outra Conta.

## Assumptions

- Reutilizar capacidades existentes indicadas em research.md; Componentes e Sistemas mantêm nomes de UI e cadastros.
- Decisões do Fabrício prevalecem; sem nova dúvida funcional bloqueadora. Contratos técnicos são verificados antes da liberação correspondente.
- Reutilizar propostas/versões do Comercial para fornecimento e serviço operacional, vincular OS/lista e preservar compatibilidade com orçamentos legados do PCM.
- Catálogo do caderno: CT-024 e CT-025; evidência deve informar versão, ambiente, executor, data e ressalvas.

## Fora de escopo

Fila financeira E01-S182; parser/lista E01-S179; cobrança real; alteração de política de preço sem autorização. Nesta etapa, somente especificação; nenhuma migration aplicada, deploy, cobrança ou tarefa Auvo real.

