# Feature Specification: E01-S184 — Proteção de custos em respostas e documentos do Portal

**Feature Branch**: `codex/handoff-plano-manutencao`
**Created**: 2026-10-26
**Status**: Especificada — implementação não iniciada
**Input**: Caderno Técnico de Implementação SSO v1, SSO-015, SSO-018 e SSO-019, e definições do Fabrício de 26/10/2026.
**Dependências**: Independente; correção crítica prévia à E01-S181/E01-S183.

## User Scenarios & Testing

### User Story 1 — Receber somente campos públicos (Priority: P1)

Cliente não recebe custo, margem ou composição interna nem em resposta oculta pela UI.

**Why this priority**: Entrega o primeiro fluxo verificável da story.
**Independent Test**: Semear custo sentinela no snapshot, consultar como Cliente e inspecionar JSON bruto.

**Acceptance Scenarios**:

1. **AC-1** — **Given** proposta enviada contendo custo, margem, piso, fator e dados de fornecedor no snapshot privado, **When** Cliente consultar Portal, views ou funções disponíveis, **Then** resposta contém somente campos explicitamente autorizados, descrição e preço de venda; campos internos e seus valores sentinela não aparecem em nenhuma profundidade.
2. **AC-2** — **Given** tabelas legadas de orçamento e versões acessíveis por rotas antigas, **When** Cliente consultar diretamente tabelas, funções, exportação ou detalhes, **Then** mesma sanitização ou negação é aplicada; estreitar view sem fechar acesso direto não é aceito e dados de outra Conta são negados.

### User Story 2 — Gerar documento público sem alterar histórico interno (Priority: P1)

Peça recebida pelo Cliente apresenta preço final autorizado.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Baixar versão antiga/nova e comparar privado intacto com público sanitizado.

**Acceptance Scenarios**:

1. **AC-3** — **Given** snapshot privado com custos unitários e totais internos, **When** Cliente baixar PDF de proposta, **Then** documento usa somente snapshot público da versão, inclui preço de venda autorizado e nunca usa custo como substituto de preço; sem preço público de item mostra somente total autorizado.
2. **AC-4** — **Given** proposta histórica já enviada ou aprovada, **When** aplicar correção e reabrir versão, **Then** snapshot privado e decisões permanecem imutáveis; projeção pública sanitizada é derivada da mesma versão com trilha da correção, e não de composição atual editável.

### User Story 3 — Proteger acesso interno autorizado e anexos (Priority: P1)

Compras/Comercial mantêm trabalho interno sem expor custos ao Cliente.

**Why this priority**: Preserva integridade e rastreabilidade do fluxo operacional.
**Independent Test**: Comparar usuário interno com e sem ver custos; verificar link de anexo.

**Acceptance Scenarios**:

1. **AC-5** — **Given** usuário interno com e sem permissão de custos, **When** consultar composição, editar preço ou exportar, **Then** somente autorizado recebe campos internos; permissões são checadas no servidor e leitura geral de módulo não libera custo por padrão.
2. **AC-6** — **Given** nota de compra, comprovante privado, arquivo antigo ou URL previamente compartilhada, **When** Cliente tentar download, **Then** arquivo privado exige autorização atual; artefatos públicos antigos com custos são inventariados e retirados de acesso público por operação auditada, preservando original interno e evidência da correção.

### Edge Cases

- Repetição e concorrência não duplicam objetos nem substituem decisões; edição obsoleta apresenta conflito explícito.
- Mudança de Conta ou revogação de usuário não mantém acesso por cache, URL direta ou anexo.
- Registro histórico incompleto permanece identificável; não completar valores ou decisões por inferência.

## Requirements

### Functional Requirements

- **FR-001**: Criar representação pública por allowlist, incluindo nested JSON; remover apenas nomes conhecidos de campo não é suficiente.
- **FR-002**: Bloquear acesso direto a snapshots/composição por cliente e usuário sem ver custos, incluindo orçamento PCM legado cujo SELECT atual é amplo.
- **FR-003**: Separar formatação PDF público e interno; não passar snapshot privado ao navegador Cliente.
- **FR-004**: Não reescrever proposta_versoes privada nem decisões históricas para sanitizar; projetar público por versão e registrar reparação de artefatos.
- **FR-005**: Inventariar views/RPCs/grants/Storage/exports, testar A/B e usuário interno sem custos; frontend escondendo campo não constitui correção.
- **FR-006**: Correção documental não afirma exposição confirmada em produção; implementação deve inventariar quais arquivos foram publicados antes de remediar acesso.

### Key Entities

Snapshot privado; projeção pública versionada; permissão de custos; audiência de documento/anexo; registro de remediação.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos seis cenários de aceite são demonstráveis em ambiente de teste com autoria e vínculos recuperáveis.
- **SC-002**: Dez reenvios simultâneos do mesmo pedido não geram duplicidade ou decisão adicional.
- **SC-003**: Nenhuma consulta ou ação sem autorização revela dados privados de outra Conta.

## Assumptions

- Reutilizar capacidades existentes indicadas em research.md; Componentes e Sistemas mantêm nomes de UI e cadastros.
- Decisões do Fabrício prevalecem; sem nova dúvida funcional bloqueadora. Contratos técnicos são verificados antes da liberação correspondente.
- Remover composição interna de todos os caminhos acessíveis ao Cliente e separar documento público do snapshot privado preservado.
- Catálogo do caderno: CT-024 e CT-027; evidência deve informar versão, ambiente, executor, data e ressalvas.

## Fora de escopo

Reformar motor de preço, reprecificar propostas históricas, apagar evidências ou comunicar terceiros automaticamente. Nesta etapa, somente especificação; nenhuma migration aplicada, deploy, cobrança ou tarefa Auvo real.

