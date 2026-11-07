# E01-S185 — Painel de reconciliação de integrações

**Status:** especificada, não implementada · **Owner de execução:** Terra · **Data:** 2026-10-26  
**Branch de especificação:** `codex/handoff-plano-manutencao`  
**Dependências:** E01-S168, E01-S175, E01-S181, E01-S182.  
**Fontes:** Caderno Técnico v1 SSO-020; CT-005, CT-028, CT-029; integrações Auvo, Comercial e Financeiro; `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md`.

## User Scenarios & Testing

### US1 — Identificar objeto, causa e impacto (P1)

**Valor:** Identificar objeto, causa e impacto com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-1:** Given falhas/divergências de Auvo, orçamento ou faturável, When operador autorizado abre painel, Then vê objeto/Cliente, estado desejado e observado, causa, tentativa, última sincronização e ação possível, com filtros e acesso ao contexto; Cliente sem permissão não vê painel nem custos internos.
- **AC-2:** Given fila processando, tentativa antiga ou webhook repetido, When painel é atualizado, Then distingue pendente, processando, falha conhecida, incerto, conflito e resolvido sem mostrar sucesso falso; guarda correlação e histórico de tentativas sem expor segredo ou payload sensível.

### US2 — Recuperar sem repetir efeitos (P1)

**Valor:** Recuperar sem repetir efeitos com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-3:** Given falha recuperável e usuário autorizado, When solicita retentativa com requestId e versão, Then comando reutiliza idempotência do fluxo proprietário; duplo clique e dois operadores não geram nova task, nova versão comercial indevida ou segundo item faturável; negação servidor para usuário sem permissão.
- **AC-4:** Given resultado remoto incerto, When solicita conciliação, Then consulta origem/destino e só confirma vínculo inequívoco; zero resultados só permite retry após ausência comprovada e múltiplos candidatos exigem decisão auditada, nunca novo POST cego nem exclusão automática.

### US3 — Tratar conflito e prevenir regressão (P1)

**Valor:** Tratar conflito e prevenir regressão com origem, decisão e resultado rastreáveis.
**Teste independente:** fixtures da fase e integração simulada, sem API real.

- **AC-5:** Given evento antigo ou conflito entre estado PCM e externo, When reconciliação roda, Then aplica precedência do fluxo proprietário e preserva validação/decisão financeira, registrando divergência; correção só ocorre por comando autorizado, sem reabrir/fechar objetos por inferência.
- **AC-6:** Given falha de job, webhook perdido ou tentativa presa, When varredura periódica encontra condição, Then cria/atualiza mesma ocorrência de reconciliação e apresenta recuperação possível; lease vencido após possível escrita vira incerto, e recuperação concluída fecha alerta mantendo histórico.

### Edge Cases

4xx permanente, 429/5xx, timeout após POST, dois operadores, callback tardio após resolução, lease órfão, webhook perdido, divergência financeira e acesso cruzado entre Clientes.

## Requirements

- **FR-001:** Preservar identidades, vínculos, evidências e histórico existentes; toda ação deve identificar origem, ator e resultado.
- **FR-002:** Tratar reentrega, concorrência e resultado desconhecido explicitamente; negar acesso sem permissão no servidor.
- **FR-003:** Oferecer contexto, causa e ação recuperável; não declarar sucesso enquanto houver resultado incerto.
- **FR-004:** Cumprir cada AC desta especificação e contratos compartilhados sem criar caminhos paralelos de efeito externo.

### Key Entities

Ocorrência de reconciliação: UUID, integração, tipo/id objeto, Cliente, versão, causa/código, estado desejado/observado minimizado, status, última tentativa/sync, ação permitida e correlationId.

## Success Criteria

- **SC-001:** Todos os AC passam em testes reproduzíveis, incluindo permissão negada e reentrega concorrente.
- **SC-002:** Nenhum cenário do catálogo CT citado cria duplicata ou apaga histórico; todo resultado fica rastreável ao objeto e à decisão responsável.
- **SC-003:** Operador encontra causa e ação possível para cada falha simulada, sem acesso a dados fora de seu escopo.

## Assumptions and Boundaries

Somente especificação nesta etapa. Sem replay irrestrito de payload, envio manual fora de T−24, exclusão automática de duplicata, implantação ou mudança de decisão comercial/financeira. Dependências devem estar concluídas antes da implementação integrada; testes podem ser preparados com fixtures. Gates técnicos não são perguntas de negócio pendentes ao Fabrício. ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` governam implementação futura.
