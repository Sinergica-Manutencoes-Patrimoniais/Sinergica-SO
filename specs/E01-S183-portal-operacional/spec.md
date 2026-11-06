# Feature Specification: E01-S183 — Portal operacional de materiais, orçamento e cobrança

**Feature Branch**: `codex/handoff-plano-manutencao`
**Created**: 2026-10-26
**Status**: Especificada — implementação não iniciada
**Input**: Caderno Técnico de Implementação SSO v1, SSO-018, e definições do Fabrício de 26/10/2026.
**Dependências**: E01-S179, E01-S181, E01-S182, E01-S184 e E01-S170.

## User Scenarios & Testing

### User Story 1 — Consultar e informar disponibilidade de materiais (Priority: P1)

Cliente comunica material disponível sem simular conferência física.

**Why this priority**: Entrega o primeiro fluxo verificável da story.
**Independent Test**: Cliente A informa disponibilidade; PCM vê aviso; Cliente B é recusado.

**Acceptance Scenarios**:

1. **AC-1** — **Given** lista atribuída ao Cliente e contato ativo, **When** abrir lista ligada à OS e informar disponível ou parcial, **Then** responsabilidade e situação ficam visíveis e informação registra contato/data; confirmação é informativa e não equivale a conferência física da Sinérgica.
2. **AC-2** — **Given** lista informada disponível mas técnico detectou falta, **When** abrir mesma OS e lista, **Then** Portal exibe exceção e situação atualizada preservando comunicação anterior; OS permanece a mesma durante suspensão/reprogramação.

### User Story 2 — Decidir versão e acompanhar cobrança (Priority: P1)

Cliente decide objeto exato e entende efeitos sem ver custos.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Aprovar versão vigente, recusar antiga e consultar documento financeiro público.

**Acceptance Scenarios**:

1. **AC-3** — **Given** orçamento público enviado e vigente da própria Conta, **When** aprovar ou recusar, **Then** decisão registra contato/versão/data/motivo quando recusado; versão obsoleta ou expirada é recusada e repetição idêntica não cria OS nem decisão duplicadas.
2. **AC-4** — **Given** OS, orçamento e item faturável relacionados, **When** navegar pelo Portal, **Then** Cliente vê descrição/preço autorizados, situação e documento público de cobrança; nunca custo, margem, nota de compra, fornecedor interno ou comprovante privado de despesa.

### User Story 3 — Isolar Contas e revogar contatos (Priority: P1)

Alterar URL ou reutilizar sessão não expõe outro condomínio.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Tentar objetos de B pela sessão de A e repetir depois de revogar contato.

**Acceptance Scenarios**:

1. **AC-5** — **Given** Cliente A autenticado e IDs do Cliente B, **When** consultar lista, orçamento, OS, cobrança, anexo ou decidir via acesso direto, **Then** servidor nega acesso sem revelar conteúdo; mesma proteção vale para listagem, exportação, download e URLs de arquivo.
2. **AC-6** — **Given** dois contatos ativos autorizados e um contato depois revogado, **When** consultar e decidir com respectivas sessões, **Then** contatos ativos atuam conforme permissões concedidas com autor individual; revogado perde leitura/escrita no servidor, inclusive com sessão anterior, e decisões passadas conservam autoria.

### Edge Cases

- Repetição e concorrência não duplicam objetos nem substituem decisões; edição obsoleta apresenta conflito explícito.
- Mudança de Conta ou revogação de usuário não mantém acesso por cache, URL direta ou anexo.
- Registro histórico incompleto permanece identificável; não completar valores ou decisões por inferência.

## Requirements

### Functional Requirements

- **FR-001**: Estender gateway/adapters de Portal existentes; não criar Portal paralelo nem importar features PCM/Comercial/Financeiro diretamente.
- **FR-002**: Disponibilidade é informação do Cliente, com autor e data; exceção de campo é separada da confirmação.
- **FR-003**: Contatos múltiplos compartilham somente Conta autorizada; cada decisão preserva autor e permissão efetiva.
- **FR-004**: Revogação precisa valer em acesso servidor mesmo com JWT anterior; claims de Conta não são autorização suficiente após revogação.
- **FR-005**: Projeções públicas sanitizadas e anexos públicos selecionados; custos nunca trafegam para navegador Cliente.
- **FR-006**: Carregamento, vazio, erro e sucesso, foco por teclado e cache segregado por Conta/usuário; troca de Conta/sessão limpa dados anteriores.

### Key Entities

Contato autorizado; vínculo à Conta; informação de disponibilidade; orçamento público versionado; decisão; OS pública; cobrança pública; anexo autorizado.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos seis cenários de aceite são demonstráveis em ambiente de teste com autoria e vínculos recuperáveis.
- **SC-002**: Dez reenvios simultâneos do mesmo pedido não geram duplicidade ou decisão adicional.
- **SC-003**: Nenhuma consulta ou ação sem autorização revela dados privados de outra Conta.

## Assumptions

- Reutilizar capacidades existentes indicadas em research.md; Componentes e Sistemas mantêm nomes de UI e cadastros.
- Decisões do Fabrício prevalecem; sem nova dúvida funcional bloqueadora. Contratos técnicos são verificados antes da liberação correspondente.
- Cliente acompanha materiais, responsabilidade, orçamento/decisão, OS e cobrança pelo mesmo contexto com isolamento e dados públicos.
- Catálogo do caderno: CT-027; evidência deve informar versão, ambiente, executor, data e ressalvas.

## Fora de escopo

Novo cadastro de técnico no SSO; conciliação financeira interna; publicação automática de anexos; criação do Copiloto. Nesta etapa, somente especificação; nenhuma migration aplicada, deploy, cobrança ou tarefa Auvo real.

