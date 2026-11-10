---
name: "docs-adr-0111-escopo-continuidade-chamado-md"
description: "Documento Sinérgica SO: ADR-0111 — Escopo integral e continuidade do Chamado"
alwaysApply: false
---

# ADR-0111 — Escopo integral e continuidade do Chamado

**Estado:** proposta não aplicada e não homologada; complementa ADR-0026 e ADR-0107.

## Decisão

Registrar parcelas explícitas de escopo do Chamado e propostas de continuidade separadamente de OS. Uma parcela só pode ser considerada atendida mediante comando auditado futuro; nenhuma contagem de OS encerradas comprova integralidade. Proposta técnica conserva a OS anterior, descrição e esforço restante; revisão PCM deve ocorrer antes da criação de outra OS, sem copiar trabalho já executado.

A fundação 0330 não aceita escrita externa nem concede acesso direto. Função de avaliação preparada exige gate 1:N, capacidade atual e composição expressamente declarada completa; gate fechado e EXECUTE revogado. Não marca o Chamado apto quando não há parcelas, quando uma parcela está pendente ou quando há proposta ainda não resolvida, OS não finalizada ou OS ausente. Ela é apenas leitura, não encerra Chamado nem cria OS. Não se presume que carga legada tenha composição completa.

## Fases e limites

Antes de abrir o gate, implementar transações de composição, validação PCM, criação de continuação e encerramento com serialização de Chamado, OS, parcelas, pendências e revogação; constraints cross-Cliente e compatibilidade das escritas legadas; histórico append-only; idempotência; critérios de atendimento mensuráveis; retorno ao backlog; revisão adversarial e testes positivos/negativos/concorrentes. Revisão de Chamado não prova alteração de escopo ou OS sem disciplina de locks dos outros escritores. Avaliação não garante que aprovação e encerramento posteriores permaneçam válidos. Não liberar nenhuma ação baseada somente nessa função.

Antes de qualquer aplicação, verificar migração em ambiente descartável, catálogo de status legado, permissões e ausência de efeitos externos. Rollback depende de inventário de uso das novas tabelas; não remover registros de produção.

0333 prepara comandos privados e inacessíveis para adicionar/atender parcelas, declarar composição, sugerir continuidade, aprovar proposta com criação de OS e registrar encerramento separado. A criação de continuação mantém vínculo e descrição restante, mas **ainda não grava o esforço restante na OS** nem comprova parcela executada ou revisão técnica; não é solução completa. Dois requestIds aninhados podem disputar locks em ordem inversa e exigem desenho e teste concorrente. `sso_encerrado_em` não muda `status` legado nem impede escritores antigos: **não representa encerramento operacional integrado**. Atender parcela exige OS finalizada mas ainda não prova cobertura real da parcela. Revisão de permissões, serialização contra inclusão/alteração de OS e a integração dos leitores/escritores são pré-requisitos de segurança; os protótipos permanecem sem EXECUTE e gate fechado. Encerramento atualiza o Chamado uma vez; a revisão desta regra ainda é necessária. Novas capacidades citadas pelo comando não foram cadastradas.
