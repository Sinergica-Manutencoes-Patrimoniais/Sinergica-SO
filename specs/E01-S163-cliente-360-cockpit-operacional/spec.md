# Feature Specification: Cliente 360 como cockpit operacional

**Feature Branch**: `docs/E01-S163-cliente-360-cockpit-operacional`

**Created**: 2026-10-06

**Status**: Ready for implementation

**Input**: Evoluir o Cliente 360 para concentrar o trabalho diário de manutenção: identificador assistido, filtros úteis, preventivas operáveis, detalhes contextuais e exclusão dos apontamentos de visita das listas de OS.

## Product assessment

Os seis pedidos formam um único problema de produto: o Cliente 360 exibe muitos dados, mas ainda não funciona como espaço de trabalho. A solução não deve copiar telas globais para dentro dele; deve reutilizar as mesmas regras e superfícies de detalhe, sempre limitadas ao cliente em foco.

Decisões de experiência e manutenção:

- Lista é a visão inicial mais eficiente para triagem de preventivas; calendário serve ao planejamento e timeline à leitura cronológica.
- Detalhes abrem em drawer contextual, preservando cliente, aba, filtros, rolagem e foco. Modal central bloquearia comparação e navegação lateral.
- “Início visita” e “Fim visita” são apontamentos de jornada. Continuam disponíveis na agenda/auditoria do técnico, mas não contam nem aparecem como OS de manutenção.
- Uma preventiva já executada é registro auditável. Alterar alvo ou âncora de recorrência não pode reescrever o passado; o operador pausa o plano anterior e cria outro.
- Recomendações de sigla precisam de ação explícita. O sistema preenche uma prévia revisável, sem gravar silenciosamente.
- Filtros devem responder a perguntas operacionais reais e usar os dados já limitados ao cliente. Índice novo só será proposto após medição demonstrar necessidade.
- A navegação com muitas abas deve ganhar agrupamento e ações rápidas, sem remover os hubs globais especializados.

## User Scenarios & Testing

### User Story 1 - Resolver identificadores sem redigitação (Priority: P1)

Ao cadastrar ou editar componente/sistema com siglas ausentes, Fabrício aceita as recomendações e recebe o identificador completo no campo correspondente antes de salvar.

**Why this priority**: O identificador liga ativo, localização, QR code e histórico. Erro ou abandono aqui degrada toda a rastreabilidade.

**Independent Test**: Abrir um componente sem siglas cadastradas, aplicar as recomendações, revisar o identificador calculado e salvar; reabrir e confirmar siglas e identificador persistidos.

**Acceptance Scenarios**:

1. **AC-1 — Aplicar recomendações**: **Given** um componente ou sistema cujo caminho contém siglas ausentes, **When** o usuário aciona “Aplicar recomendações”, **Then** todas as sugestões válidas visíveis são usadas para recalcular e preencher a prévia do campo Identificador, sem persistência antes de “Salvar”.
2. **AC-2 — Revisar antes de salvar**: **Given** sugestões editáveis, **When** o usuário altera uma sigla e aplica as recomendações, **Then** a prévia usa o valor alterado, identifica qualquer pendência restante e só permite concluir quando o identificador for válido e único.
3. **AC-3 — Persistência consistente**: **Given** um identificador válido calculado, **When** o usuário salva, **Then** siglas ausentes e identificador são persistidos pela mesma operação lógica; em falha, o modal permanece aberto, apresenta o erro e não cria/atualiza o ativo parcialmente.
4. **AC-4 — Identificador existente protegido**: **Given** um ativo com identificador não vazio, **When** o usuário abre a edição, **Then** nenhuma recomendação o substitui silenciosamente e permanecem os avisos existentes sobre edição e QR code.

---

### User Story 2 - Operar OS e chamados sem sair do Cliente 360 (Priority: P1)

Fabrício abre uma OS ou chamado a partir de qualquer lista do Cliente 360, entende o contexto completo e executa as mesmas ações autorizadas da área global, sem perder seu lugar.

**Why this priority**: A saída da tela a cada consulta quebra o fluxo central de triagem e aumenta risco de agir no cliente errado.

**Independent Test**: Aplicar filtros na aba OS, rolar a lista, abrir uma OS com chamado associado, consultar histórico e fechar; a aba, filtros, seleção e rolagem continuam intactos.

**Acceptance Scenarios**:

1. **AC-5 — Drawer contextual compartilhado**: **Given** uma OS exibida no Resumo, Timeline ou aba OS, **When** o usuário a seleciona, **Then** abre um drawer com os mesmos dados e ações autorizadas da visão global, sem navegação para fora do Cliente 360.
2. **AC-6 — Chamado associado**: **Given** uma OS vinculada a chamado, **When** seu detalhe é aberto, **Then** o drawer reutiliza o painel de Chamados para mostrar dados, histórico e ações, sem implementação duplicada de regra de negócio.
3. **AC-7 — Contexto preservado**: **Given** aba, filtros e rolagem ativos, **When** o drawer é fechado, **Then** o foco volta ao item de origem e todo o contexto visual é preservado; trocar de cliente fecha detalhes antigos e impede dado residual.
4. **AC-8 — Mutação coerente**: **Given** uma ação autorizada concluída no drawer, **When** o backend confirma a alteração, **Then** as consultas afetadas do Cliente 360 e da área global são invalidadas e refletem o mesmo estado.
5. **AC-9 — Apontamentos fora de OS**: **Given** registros intitulados “Início visita” ou “Fim visita”, com variações de caixa, acento ou espaço, **When** backlog, histórico, KPIs ou timeline de manutenção do Cliente 360 são calculados, **Then** esses registros não aparecem nem contam, mas permanecem na agenda/apontamento e auditoria do técnico.

---

### User Story 3 - Planejar e investigar preventivas (Priority: P1)

Fabrício alterna entre Lista, Timeline e Calendário e abre ocorrências ou planos para consultar planejamento, histórico de execução e OS associadas.

**Why this priority**: O calendário isolado é ruim para triagem, comparação e investigação de recorrência; manutenção preventiva exige visão do futuro e evidência do realizado.

**Independent Test**: Abrir Preventivas, alternar as três visões, selecionar a mesma ocorrência em cada uma e confirmar o mesmo detalhe, histórico e associação com OS.

**Acceptance Scenarios**:

1. **AC-10 — Três visões consistentes**: **Given** a aba Preventivas, **When** o usuário alterna entre Lista, Timeline e Calendário, **Then** as três visões apresentam o mesmo conjunto limitado ao cliente, com Lista como padrão no primeiro uso e a última visão lembrada localmente no navegador.
2. **AC-11 — Detalhe da ocorrência**: **Given** uma ocorrência em qualquer visão, **When** o usuário a seleciona, **Then** abre o mesmo drawer com plano, alvo, vencimento, visita, técnico, estado, resultado, OS associada e link Auvo quando houver.
3. **AC-12 — Detalhe do plano**: **Given** um plano preventivo, **When** o usuário o seleciona, **Then** abre drawer com estado, recorrência, alvo, próximas ocorrências, histórico de execuções e OS associadas, além das ações permitidas.
4. **AC-13 — Edição auditável**: **Given** um plano sem ocorrência materializada, **When** o usuário edita metadados, alvo ou recorrência, **Then** a alteração é validada e refletida; após a primeira ocorrência materializada, alvo e âncora/intervalo ficam bloqueados e a interface orienta pausar o plano e criar outro.
5. **AC-14 — Histórico imutável**: **Given** ocorrências enviadas, executadas ou concluídas, **When** um plano é editado, pausado ou encerrado, **Then** datas, resultado e vínculo com OS históricos não são regravados nem apagados.
6. **AC-15 — Estados operacionais**: **Given** carregamento, ausência de dados ou falha de uma seção, **When** o drawer ou uma visão é aberto, **Then** há estado local de loading/empty/error e retry sem bloquear as demais áreas do Cliente 360.

---

### User Story 4 - Encontrar estruturas e ativos com filtros úteis (Priority: P2)

Fabrício combina filtros específicos nas abas Estrutura, Componentes, Sistemas e Ferramentas para reduzir o universo do cliente ao conjunto que exige ação.

**Why this priority**: A busca textual sozinha não responde perguntas como “extintores desta área sem sistema” ou “ferramentas ainda alocadas”.

**Independent Test**: Em um cliente com dados variados, combinar dois ou mais filtros em cada aba, confirmar contagem e isolamento, limpar tudo e recuperar o conjunto original.

**Acceptance Scenarios**:

1. **AC-16 — Estrutura**: **Given** a aba Estrutura, **When** filtros são aplicados, **Then** é possível buscar por nome/caminho e filtrar por tipo de nó, área/raiz e presença de ativos vinculados; ancestrais necessários continuam visíveis para dar contexto ao resultado.
2. **AC-17 — Componentes**: **Given** a aba Componentes, **When** filtros são aplicados, **Then** é possível buscar nome/identificador e filtrar por categoria, área/local, sistema (incluindo “Sem sistema”), situação ativa e estado de sincronização Auvo quando disponível.
3. **AC-18 — Sistemas**: **Given** a aba Sistemas, **When** filtros são aplicados, **Then** é possível buscar nome/identificador e filtrar por categoria, área/local e composição vazia/não vazia.
4. **AC-19 — Ferramentas**: **Given** a aba Ferramentas, **When** filtros são aplicados, **Then** é possível buscar nome e filtrar por categoria, situação de alocação (ativa/devolvida) e período de alocação.
5. **AC-20 — Composição previsível**: **Given** múltiplos filtros, **When** são combinados, **Then** critérios diferentes usam AND, escolhas múltiplas do mesmo critério usam OR, a interface mostra “visíveis de total”, permite limpar tudo e distingue “cliente sem dados” de “nenhum resultado”.
6. **AC-21 — Isolamento e desempenho**: **Given** troca de cliente ou até 1.000 itens carregados numa aba, **When** filtros são usados, **Then** nenhum dado do cliente anterior é mostrado e o resultado visual responde em até 300 ms após interação; índice novo só é aberto como trabalho arquitetural separado se medição provar insuficiência.

---

### User Story 5 - Usar o Cliente 360 como espaço diário (Priority: P2)

Fabrício encontra rapidamente Operação, Ativos e Gestão e inicia as ações mais comuns sem procurar entre uma longa faixa horizontal de abas.

**Why this priority**: A tela atual possui muitas abas de igual peso; truncamento e rolagem horizontal escondem recursos e aumentam carga cognitiva.

**Independent Test**: Em desktop e viewport estreito, navegar por todos os grupos, abrir ação rápida e voltar ao mesmo contexto usando teclado e mouse.

**Acceptance Scenarios**:

1. **AC-22 — Navegação agrupada**: **Given** o Cliente 360, **When** a navegação é exibida, **Then** as abas são agrupadas em Operação, Ativos e Gestão/Relacionamento, a área ativa é inequívoca e o overflow responsivo fica em “Mais”, sem rótulo truncado.
2. **AC-23 — Ações rápidas**: **Given** usuário com permissão, **When** acessa o cabeçalho do cliente, **Then** encontra atalhos para Novo Chamado, Nova OS, Nova Preventiva e Novo Componente; ações não autorizadas não são oferecidas.
3. **AC-24 — Acessibilidade contextual**: **Given** navegação por teclado ou drawer aberto, **When** Tab, Shift+Tab e Escape são usados, **Then** foco é contido enquanto aberto, Escape fecha apenas a camada superior e o foco retorna ao acionador; rótulos e estados são anunciados.

### Edge Cases

- A recomendação gera sigla duplicada, inválida ou colidente com identificador existente: manter edição, destacar o nível e explicar a correção.
- Parte das siglas já existe: mostrar apenas pendências, sem sobrescrever as cadastradas.
- O item de origem desaparece após uma ação no drawer: fechar preserva a lista e move foco para o contêiner, sem erro.
- OS não tem chamado, técnico, endereço ou link Auvo: exibir ausência explícita, não campo enganoso nem ação quebrada.
- Preventiva não possui ocorrências futuras ou OS associadas: cada seção tem empty state específico.
- O mesmo dia contém muitas preventivas: Lista e Timeline continuam ordenáveis; calendário agrega e oferece expansão.
- Cliente é trocado durante requisição: cancelar/ignorar resposta anterior usando chave de consulta com `clienteId`.
- Categoria ou relacionamento foi removido: manter o item acessível com rótulo “Não informado” e permitir corrigir.
- “INÍCIO VISITA”, “Inicio visita ” e equivalentes normalizados também são excluídos; títulos meramente contendo essas palavras não são excluídos.
- Falha Auvo não impede leitura local; ação dependente da integração informa pendência e retry.

## Requirements

### Functional Requirements

- **FR-001**: O sistema MUST oferecer ação explícita para aplicar recomendações de sigla e recalcular a prévia do identificador.
- **FR-002**: O sistema MUST persistir siglas e identificador por uma única operação lógica validada, sem gravação silenciosa ao apenas visualizar sugestões.
- **FR-003**: O sistema MUST reutilizar as mesmas regras de validação, unicidade e aviso de QR code já aplicadas ao identificador manual.
- **FR-004**: O sistema MUST reutilizar uma superfície compartilhada de detalhe de OS/Chamado nas áreas global e Cliente 360.
- **FR-005**: O sistema MUST preservar o contexto do Cliente 360 ao abrir e fechar detalhes e impedir vazamento entre clientes.
- **FR-006**: O sistema MUST aplicar autorização e invalidação de cache idênticas às ações equivalentes das telas globais.
- **FR-007**: O sistema MUST excluir apontamentos exatos de início/fim de visita de todas as coleções e indicadores de OS de manutenção, usando a regra de domínio existente.
- **FR-008**: O sistema MUST manter apontamentos de visita nos contextos de jornada, agenda e auditoria.
- **FR-009**: O sistema MUST oferecer Lista, Timeline e Calendário para preventivas com seleção consistente.
- **FR-010**: O sistema MUST disponibilizar detalhes de ocorrência e plano com planejamento, execução, histórico e vínculos de OS.
- **FR-011**: O sistema MUST impedir alteração retroativa de ocorrências preventivas e bloquear campos estruturais do plano após materialização.
- **FR-012**: O sistema MUST combinar filtros conforme AC-16 a AC-20 e apresentar contagem, limpeza e empty states distintos.
- **FR-013**: O sistema MUST avaliar filtros sobre dados limitados ao `clienteId`; estado e query keys MUST incluir o cliente.
- **FR-014**: O sistema MUST usar os índices e consultas existentes primeiro; qualquer migration de índice exige evidência de plano de execução e ADR/revisão próprios.
- **FR-015**: O sistema MUST agrupar a navegação extensa e oferecer overflow acessível, mantendo todas as áreas atuais alcançáveis.
- **FR-016**: O sistema MUST exibir ações rápidas apenas quando a política vigente autorizar a operação.
- **FR-017**: O sistema MUST suportar teclado, retorno de foco, Escape em pilha, rótulos acessíveis e redução de movimento nos drawers.
- **FR-018**: O sistema MUST registrar eventos de produto sem dados sensíveis para abertura de drawer, troca de visão, uso de filtro, aplicação de siglas e conclusão/cancelamento de ação.

### Key Entities

- **Cliente 360 Context**: cliente ativo, grupo/aba, filtros, rolagem, visão preventiva e camada de detalhe aberta.
- **Identificador assistido**: caminho hierárquico, siglas persistidas, sugestões editáveis, sequência e prévia calculada.
- **Ordem de serviço de manutenção**: OS operacional; exclui eventos de apontamento de visita das projeções do cockpit.
- **Chamado**: origem/solicitação associável a uma OS, com histórico e ações já existentes.
- **Plano preventivo**: regra recorrente, alvo, estado e metadados; seus campos estruturais tornam-se imutáveis após materialização.
- **Ocorrência preventiva**: ciclo datado e auditável, associado opcionalmente a visita, técnico, OS e Auvo.
- **Filtro do cliente**: estado efêmero por aba, nunca fonte de autorização nem substituto do escopo no backend.

## Success Criteria

- **SC-001**: Fabrício abre uma OS/Chamado, consulta histórico, executa ação permitida e retorna ao mesmo ponto do Cliente 360 sem navegação de página em 100% dos cenários aceitos.
- **SC-002**: Nenhuma variação normalizada de “Início visita”/“Fim visita” aparece ou conta em OS de manutenção do Cliente 360 nos testes de domínio, integração e E2E.
- **SC-003**: Um operador localiza um item-alvo com dois filtros e abre seu detalhe em até 30 segundos numa massa de 1.000 itens.
- **SC-004**: Após carregamento, alterações de filtro mostram resultado em até 300 ms no percentil 95 em máquina de referência do CI.
- **SC-005**: Lista, Timeline e Calendário retornam a mesma quantidade de ocorrências para cliente e período equivalentes.
- **SC-006**: Nenhuma edição de plano altera ocorrências materializadas, datas executadas, resultados ou vínculos históricos.
- **SC-007**: Aplicar recomendações reduz a zero a redigitação das siglas sugeridas e nunca persiste valor antes da confirmação “Salvar”.
- **SC-008**: Testes automatizados demonstram isolamento entre dois clientes em filtros, drawers, queries e mutações.
- **SC-009**: Todos os grupos e ações do cockpit são alcançáveis e operáveis somente por teclado, sem truncamento de rótulo nos viewports suportados.

## Assumptions

- Desktop é o principal ambiente de Fabrício; viewports estreitos continuam funcionais, mas uma reformulação mobile completa não faz parte desta story.
- O Cliente 360 não substitui os hubs globais; ele reutiliza as mesmas regras e componentes para o contexto de um cliente.
- A última visão preventiva é preferência local do navegador, sem nova tabela de perfil.
- A lista de preventivas é a visão padrão na primeira utilização.
- O escopo inicial usa dados já carregados por cliente e índices existentes. Migração só ocorre em story arquitetural se medição justificar.
- O formulário, fotos e evidências completas do Auvo continuam acessados por link; não serão replicados.

## Out of Scope

- Apagar registros de início/fim de visita ou removê-los da agenda/auditoria.
- Reescrever roteamento geral ou criar deep links para todas as abas.
- Reproduzir integralmente formulários e anexos do Auvo.
- Editar ocorrências preventivas históricas ou mover execução passada para outro plano.
- Criar migrations/índices preventivamente, sem benchmark e plano de execução.
- Substituir as telas globais de Chamados, OS ou Preventivas.
