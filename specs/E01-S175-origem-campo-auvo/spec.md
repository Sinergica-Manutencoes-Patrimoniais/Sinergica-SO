# E01-S175 — Origem de campo Auvo e triagem PCM

**Status:** especificada, não implementada · **Owner de execução:** Terra · **Data:** 2026-10-26  
**Branch de especificação:** `codex/handoff-plano-manutencao`  
**Dependências:** E01-S167, E01-S170.  
**Fontes:** Caderno Técnico v1 SSO-009; §6.4; CT-020, CT-021; definições Fabrício sobre Auvo provisório; `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md`.

## User Scenarios & Testing

### US1 — Ingerir tarefa com referência de Chamado (P1)

**Valor:** Ingerir tarefa com referência de Chamado com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-1:** Given tarefa Auvo nova com referência inequívoca a Chamado válido do mesmo Cliente, When webhook ou polling recebe tarefa, Then cria/vincula exatamente uma OS àquele Chamado, preservando ID externo, descrição, técnico, horários e evidências; tarefa já executada não espera aprovação SSO.
- **AC-2:** Given referência ausente/inválida ou de outro Cliente, When tarefa é ingerida, Then não liga ao Chamado incorreto; cria exatamente uma OS e Chamado provisório do Cliente resolvido com descrição de origem, razão de triagem e vínculo auditado; Cliente ainda desconhecido deixa recebimento pendente recuperável, sem descartar fato.

### US2 — Conciliar contêiner sem apagar execução (P1)

**Valor:** Conciliar contêiner sem apagar execução com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-3:** Given Chamado provisório, When PCM autorizado confirma ou corrige metadados, Then registra decisão/ator/data e conserva OS, tarefa e evidências; sem permissão é negado no servidor.
- **AC-4:** Given provisório com OS executada, When PCM une a outro Chamado do mesmo Cliente, marca duplicidade ou cancela contêiner com motivo, Then conserva OS/evidências, registra origem/destino e nunca cancela tarefa executada automaticamente; contêiner cancelado mantém referência histórica e não invalida execução.

### US3 — Reprocessar e distinguir levantamento (P1)

**Valor:** Reprocessar e distinguir levantamento com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-5:** Given mesma task recebida por webhook/polling concorrentes ou editada depois, When processada, Then continua uma OS e um provisório no máximo; atualiza dados de origem por ordem confiável sem apagar correção PCM nem regredir execução; todo evento tem resultado observável.
- **AC-6:** Given tarefa identificada como Levantamento cadastral com questionário padronizado, When recebida, Then entrega dados estruturados, observações e fotos ao staging pendente de validação de E01-S178, sem criar ativos oficiais nem interpretar prosa automaticamente; preserva rastreabilidade à OS/tarefa e rejeita payload incompatível com causa visível.

### Edge Cases

Referência de outro Cliente, task externa que na verdade já possui OS SSO, referência inexistente, Cliente não sincronizado, chegada simultânea webhook/polling, união concorrente, tarefa concluída antes da ingestão, evento antigo após correção PCM, questionário desconhecido.

## Requirements

- **FR-001:** Preservar identidades, vínculos, evidências e histórico existentes; toda ação deve identificar origem, ator e resultado.
- **FR-002:** Tratar reentrega, concorrência e resultado desconhecido explicitamente; negar acesso sem permissão no servidor.
- **FR-003:** Oferecer contexto, causa e ação recuperável; não declarar sucesso enquanto houver resultado incerto.
- **FR-004:** Cumprir cada AC desta especificação e contratos compartilhados sem criar caminhos paralelos de efeito externo.

### Key Entities

Inbox de origem: chave integração/taskId/evento, payload_ref, timestamp, estado aplicado/pendente/erro e razão.

## Success Criteria

- **SC-001:** Todos os AC passam em testes reproduzíveis, incluindo permissão negada e reentrega concorrente.
- **SC-002:** Nenhum cenário do catálogo CT citado cria duplicata ou apaga histórico; todo resultado fica rastreável ao objeto e à decisão responsável.
- **SC-003:** Operador encontra causa e ação possível para cada falha simulada, sem acesso a dados fora de seu escopo.

## Assumptions and Boundaries

Somente especificação nesta etapa. Sem Copiloto Técnico completo; E01-S178 implementa conferência/aprovação do staging. Não mudar identidade de ativo nem inferir classificação a partir de texto corrido. Dependências devem estar concluídas antes da implementação integrada; testes podem ser preparados com fixtures. Gates técnicos não são perguntas de negócio pendentes ao Fabrício. ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` governam implementação futura.
