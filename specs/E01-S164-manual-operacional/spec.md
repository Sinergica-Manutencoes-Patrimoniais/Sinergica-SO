# Feature Specification: Manual operacional do PCM

**Feature Branch**: `feat/E01-S164-manual-operacional`
**Created**: 2026-10-14
**Status**: Implemented locally — publication pending
**Input**: Atualizar o manual para a versão atual, priorizando abertura de Chamados e OS, Cliente 360 e cadastro de Componentes/Sistemas; oferecer ajuda discreta nas telas para autonomia do Fabrício.

## User Scenarios & Testing

### User Story 1 — Executar uma tarefa consultando o manual (Priority: P1)

Fabrício encontra a tarefa, entende quando usá-la, preenche os campos e confere o resultado sem depender de orientação verbal.

**Why this priority**: A documentação atual é uma apresentação dos módulos, insuficiente para operar.
**Independent Test**: Buscar “abrir OS”, consultar passos, conferência, vínculo Auvo e soluções de dúvidas.

**Acceptance Scenarios**:
1. **AC-1**: O manual diferencia Chamado, OS, backlog e tarefa Auvo, informa como cadastrar, converter, priorizar, planejar e verificar envio, com exemplos e nomes reais das ações.
2. **AC-2**: O manual ensina a rotina pelo Cliente 360, seus grupos, filtros, detalhes contextuais, histórico, preventivas e ferramentas; explica quando consultar as telas globais.
3. **AC-3**: O manual ensina Estrutura, Componentes e Sistemas, categoria, posição opcional em Área/Local, siglas, Aplicar recomendações, edição do Identificador e impacto nas etiquetas.
4. **AC-4**: Cada tarefa contém passos, resultado esperado/conferência e dúvidas com solução, usando somente recursos existentes; descreve limites do envio ao Auvo sem prometer sincronização imediata.

### User Story 2 — Encontrar ajuda sem perder o trabalho (Priority: P2)

Fabrício abre ajuda diretamente da tela ou formulário e mantém o trabalho aberto na aba original.

**Why this priority**: Reduz busca pelo guia e abandono de formulários.
**Independent Test**: Abrir ajuda de Nova OS e confirmar que outra aba apresenta a instrução correspondente; usar busca sem acento e navegar por teclado.

**Acceptance Scenarios**:
1. **AC-5**: Links discretos no Cliente 360, Operação e formulários de Chamado, OS, Componente e Sistema abrem o assunto correspondente em outra aba com rótulo acessível anunciando a abertura.
2. **AC-6**: O manual tem índice, busca tolerante a caixa/acentos, estado sem resultados e ligações entre assuntos; o assunto é alcançável por endereço direto e teclado, em telas largas e estreitas.

### Edge Cases

- Sem permissão de escrita: orientar administrador, sem prometer botões visíveis para todos.
- Sem técnico, data, alvo, categoria ou vínculo Auvo: distinguir cadastro incompleto, pendência de planejamento e falha de integração.
- Busca vazia ou sem resultado: manter navegação e oferecer limpeza.
- Assunto inválido no endereço: abrir início do manual.
- Formulário em edição: ajuda abre outra aba para preservar dados não salvos.

## Requirements

### Functional Requirements
- **FR-001**: Incluir instruções para os fluxos dos AC-1 a AC-4, com exemplos fictícios de manutenção predial e data da revisão.
- **FR-002**: Reusar o Guia do SO existente, mantendo os outros módulos acessíveis.
- **FR-003**: Permitir consulta contextual e pesquisa conforme AC-5 e AC-6.
- **FR-004**: Validar navegação do manual e links de ajuda com testes de interação e E2E de leitura, sem gravar dados operacionais.

### Key Entities
- Assunto do manual: título, resumo, palavras-chave, passos, conferências, dúvidas e assuntos relacionados.
- Link de ajuda: assunto de destino e rótulo; não carrega dados de cliente na URL.

## Success Criteria
- **SC-001**: Todos os seis pontos de entrada do AC-5 levam ao assunto correto em um clique.
- **SC-002**: Busca por “etiqueta”, “abrir OS” e “360” encontra as tarefas correspondentes, inclusive sem acentos.
- **SC-003**: Nenhuma instrução promete envio automático de OS ao Auvo ao apenas salvar ou mudar status.

## Assumptions
- Manual principal é o Guia do SO integrado; não será criado documento externo com conteúdo duplicado.
- Atualização cobre o PCM atual e o ajuste local de Identificador já entregue em `38165d2`.
- Fora do escopo: alterar regras de negócio, permissões, banco, integração ou reescrever os manuais dos demais módulos.
