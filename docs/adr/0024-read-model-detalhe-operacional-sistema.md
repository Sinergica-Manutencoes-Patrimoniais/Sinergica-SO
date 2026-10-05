---
name: adr-0024-read-model-detalhe-operacional-sistema
description: Consulta operacional composta de Sistema no PCM, com fontes locais delimitadas pelo cliente e sem reconstrução histórica de composição.
alwaysApply: false
---

# ADR-0024 — Read-model composto para detalhe operacional do Sistema

**Status:** Aceito
**Data:** 2026-10-05
**Decisores:** Codex, Lucas
**Relacionados:** ADR-0008, ADR-0009, `specs/E01-S162-detalhe-operacional-sistema/spec.md`, `design.md`

## Contexto

O detalhe operacional precisa reunir cadastro, componentes atuais, OS diretas ou de componentes e
preventivas do Sistema nos dois pontos de entrada do PCM. A composição anterior não possui eventos
auditáveis completos, e o formulário/execução continua no Auvo. Criar uma nova tabela materializada
ou consultar o Auvo ao abrir o drawer aumentaria a superfície de sincronização e poderia inventar
histórico que o PCM não registra.

## Decisão

Usar um read-model de frontend, composto por consultas somente-leitura às fontes PCM existentes.
Cada consulta parte do Sistema ativo e restringe dados derivados ao seu cliente. OS são deduplicadas
por ID, preservando todas as origens; componentes são apenas os membros atuais. A última manutenção
é calculada somente de `check_out_at` de OS `finalizado`. O link ao Auvo usa exclusivamente um ID
remoto positivo já persistido, sem chamada remota adicional.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|--------------------------|
| Read-model local composto (escolhida) | Sem migration, atualizado pelas fontes PCM e reutilizável nos dois pontos de entrada | Mais de uma consulta e estados parciais explícitos | Mantém PCM como fonte operacional e não inventa eventos passados |
| Tabela materializada de detalhe | Uma leitura centralizada | Migration, RLS, refresh e risco de dado defasado | Não justifica duplicar dados para uma consulta sem escrita |
| Consultar Auvo ao abrir o painel | Poderia exibir o formulário remoto | Latência, dependência externa e expõe dados fora do escopo | Contraria E01-S53 e o escopo somente de link remoto |

## Consequências

**Positivas:**

- Nenhuma migration, deploy ou escrita é necessária.
- Falha de OS, preventivas ou componentes não invalida o cadastro já carregado.
- O isolamento por cliente é aplicado nas consultas e mantido por RLS.

**Negativas / trade-offs aceitos:**

- O drawer executa consultas separadas; cada seção deve exibir seu próprio estado de carregamento,
  vazio, erro e nova tentativa.
- A composição mostra somente o estado atual; não há reconstituição retroativa sem evento auditável.
