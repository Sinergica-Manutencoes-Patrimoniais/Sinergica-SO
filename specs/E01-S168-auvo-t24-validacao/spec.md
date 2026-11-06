# E01-S168 — Auvo T−24, retorno e validação PCM

**Status:** especificada, não implementada · **Owner de execução:** Terra · **Data:** 2026-10-26  
**Branch de especificação:** `codex/handoff-plano-manutencao`  
**Dependências:** E01-S167, E01-S171, E01-S170.  
**Fontes:** Caderno Técnico v1 SSO-003; §§5.3, 6.5, 7 e 11; CT-003, CT-004, CT-005, CT-006, CT-028, CT-029; `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md`.

## User Scenarios & Testing

### US1 — Confirmar e enviar no momento correto (P1)

**Valor:** Confirmar e enviar no momento correto com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-1:** Given Visita sem confirmação PCM, When chega T−24, Then não envia nenhuma OS; ciência do Cliente somente bloqueia quando obrigatória estiver configurada.
- **AC-2:** Given Visita confirmada e OS elegível, When confirmação ocorre antes de T−24, Then aguarda início menos 24 horas; When ocorre na janela ou depois dela, Then fica imediatamente elegível; Visita cancelada/concluída e OS encerrada/cancelada não são elegíveis, e reexecução não duplica tarefa.
- **AC-3:** Given envio elegível, When gate não comprova contrato dos campos críticos ou falta vínculo obrigatório, Then bloqueia rede e apresenta causa; sucesso exige leitura posterior confirmando técnico, data, alvo e questionário quando aplicável, sem obrigar questionário preventivo em corretiva.

### US2 — Reprogramar e recuperar sem duplicar (P1)

**Valor:** Reprogramar e recuperar sem duplicar com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-4:** Given OS com tarefa, When reprogramada, Then mantém mesmo ID remoto e atualiza ao voltar à janela T−24; sem data retorna à Demanda e tarefa permanece atrasada; continuação gera outra OS e outra tarefa vinculadas ao histórico.
- **AC-5:** Given confirmar, enviar, reprogramar ou cancelar concorrentes, When comandos são processados, Then somente revisão vigente produz efeito; alteração de conteúdo ou programação invalida confirmação anterior e exige reconfirmação PCM; cancelamento autorizado exige motivo e invalida pendentes; efeito remoto já iniciado é conciliado, e resposta tardia nunca ressuscita cancelamento.
- **AC-6:** Given timeout após possível criação, When ocorre retry ou lease expira, Then estado fica incerto e busca identidade estável antes de novo POST; ausência comprovada permite retry, um candidato é reconciliado e múltiplos candidatos exigem decisão explícita.

### US3 — Validar execução no PCM (P1)

**Valor:** Validar execução no PCM com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-7:** Given conclusão Auvo, When retorno chega, Then fica Concluída em campo — aguardando validação; eventos repetidos/antigos não duplicam nem regridem estado; conserva snapshots, PMOC, laudo e execução anteriores sem duplicar registros.
- **AC-8:** Given OS aguardando validação, When operador autorizado aprova/devolve/reabre, Then registra ator, data, decisão, motivo e evidências; aprovação encerra OS individual, e ocorrência somente conclui quando escopo preventivo integral e todas suas OS necessárias estiverem validadas; Chamado nunca encerra automaticamente. Não OK mantém pendência, obrigatório Não inspecionado impede aprovação e acesso sem permissão é negado no servidor.

### Edge Cases

Janela exata, confirmação dentro da janela, UTC versus Brasília, resposta tardia após cancelamento, task recebida antes de persistir ID, worker expirado, contrato suspenso após claim, questionário ausente em corretiva, conclusão antiga e PMOC repetido.

## Requirements

- **FR-001:** Preservar identidades, vínculos, evidências e histórico existentes; toda ação deve identificar origem, ator e resultado.
- **FR-002:** Tratar reentrega, concorrência e resultado desconhecido explicitamente; negar acesso sem permissão no servidor.
- **FR-003:** Oferecer contexto, causa e ação recuperável; não declarar sucesso enquanto houver resultado incerto.
- **FR-004:** Cumprir cada AC desta especificação e contratos compartilhados sem criar caminhos paralelos de efeito externo.

### Key Entities

OS mantém UUID e auvo_task_id único, versão programação monotônica e validação separada.

## Success Criteria

- **SC-001:** Todos os AC passam em testes reproduzíveis, incluindo permissão negada e reentrega concorrente.
- **SC-002:** Nenhum cenário do catálogo CT citado cria duplicata ou apaga histórico; todo resultado fica rastreável ao objeto e à decisão responsável.
- **SC-003:** Operador encontra causa e ação possível para cada falha simulada, sem acesso a dados fora de seu escopo.

## Assumptions and Boundaries

Somente especificação nesta etapa. Sem biblioteca própria/publicação de questionário; origem de campo é E01-S175, painel consolidado é E01-S185, banco de pendências é story própria. Dependências devem estar concluídas antes da implementação integrada; testes podem ser preparados com fixtures. Gates técnicos não são perguntas de negócio pendentes ao Fabrício. ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` governam implementação futura.
