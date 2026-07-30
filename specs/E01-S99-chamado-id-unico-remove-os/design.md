---
name: design
description: Technical Design Doc — 5 eixos + dependências, solução, riscos e roadmap. Puxe ao desenhar feature arquitetural.
alwaysApply: false
---

# Technical Design Doc — Chamado como ID único (remover numeração própria de OS)

> **Tier:** arquitetural · **Status:** rascunho
> **Autor:** @architect · **Revisores:** Lucas · **Data:** 2026-07-28
> Reverte parte de E01-S88. Substitui o racional de numeração `OS-XXXX` por `CH-XXXX` ponta a ponta.

## Contexto da funcionalidade
E01-S88 modelou o Chamado (`pcm.chamados`, `CH-XXXX`) como registro rastreável e criou a sequence
`pcm.fn_proximo_numero_os` (+ `fn_proximos_numeros_os` em lote) com prefixo `OS-` para numerar
`pcm.ordens_servico`. A decisão de negócio mudou (reunião 2026-07-27): a OS não tem número próprio —
o Chamado é o identificador de ponta a ponta e "virar OS" é uma fase. Ver `product.md`.

Estado atual relevante no código:
- `pcm.chamados`: `numero` (`CH-XXXX`), `status` (`aberto | convertido_os | backlog | cancelado`),
  `ordemServicoId` (FK para a OS quando convertido). — `domain/chamados.ts`.
- `supabase/functions/_shared/auvo/os-from-task.ts`: `proximoNumeroOs` / `proximosNumerosOs`
  (RPC `fn_proximo_numero_os` / `fn_proximos_numeros_os`).
- `apps/web/src/features/pcm/domain/contexto-tarefa-auvo.ts`: monta título com `numeroOs`.
- ADR-0010 (Hub de OS estende `pcm.ordens_servico`) e ADR-0001 (PCM origin truth / external id).

## Goals / Non-goals
**Goals**
- `CH-XXXX` é o único número humano; OS herda o número do Chamado de origem.
- Task Auvo recebe `CH-XXXX` no campo **código externo** (external id).
- Descontinuar a geração de `OS-XXXX` (sequence + RPCs + usos).

**Non-goals**
- Remover a tabela/entidade `pcm.ordens_servico` (mantém UUID interno).
- Alterar SLA, Kanban ou Hub além da numeração.

## Design proposto

### Modelo
- O **Chamado é a raiz de identidade**. `pcm.ordens_servico` deixa de ter `numero` (`OS-XXXX`)
  como identificador humano; passa a referenciar o Chamado de origem (`chamado_id`) e a exibir o
  `CH-XXXX` desse Chamado onde hoje mostra `OS-XXXX`.
- "Virou OS" continua representado por `chamados.status = "convertido_os"` + `ordemServicoId`
  (flag/estado já existente). Não é preciso um número novo.

### Fluxo de numeração
1. Chamado nasce → recebe `CH-XXXX` (numeração de chamado já existente em E01-S88, **mantida**).
2. Chamado ganha data + técnico → vira OS: cria `pcm.ordens_servico` com `chamado_id` apontando de
   volta. **Não** chama `proximoNumeroOs`. O identificador exibido é o `CH-XXXX`.
3. Push para o Auvo: preenche o **código externo** da task com `CH-XXXX`
   (`os-from-task.ts` / `contexto-tarefa-auvo.ts` passam a usar `numeroChamado`).

### Contratos afetados
- Remover/descontinuar `proximoNumeroOs`, `proximosNumerosOs` e as RPCs
  `fn_proximo_numero_os` / `fn_proximos_numeros_os` (E01-S88).
- `contexto-tarefa-auvo.ts`: `numeroOs` → `numeroChamado` (o `CH-XXXX`).
- Onde a UI mostra "OS NNNN", passar a mostrar `CH-XXXX`.

## Cobertura dos 5 eixos

### 1. Tech stack
Sem lib nova. Postgres (migration para dropar/deprecar sequence + RPCs), TypeScript/Deno (edge
functions), React (labels da UI).

### 2. Arquitetura base
Reforça ADR-0001 (PCM é origin of truth; external id conecta ao Auvo): o external id passa a ser o
`CH-XXXX`. Mantém ADR-0010 (Hub estende `ordens_servico`), só remove o número humano da OS.

### 3. Infra
Migration nova `NNNN_E01-S99_*.sql`: dropar (ou marcar deprecated) sequence/RPCs de OS, adicionar
`chamado_id` em `ordens_servico` se ainda não existir, backfill do vínculo. **Depende de** as
migrations de E01-S88 ainda não estarem em produção — confirmar antes. Reversão: manter a migration
idempotente e sem perda de dados de OS existentes.

### 4. Qualidade
- Unidade: numeração de chamado inalterada; OS não gera número.
- Integração: push Auvo grava `CH-XXXX` no código externo; pull/webhook resolvem OS pelo `chamado_id`.
- Contrato: os testes de `os-from-task` e `contexto-tarefa-auvo` atualizados (hoje esperam `OS-`).
- Gate: `db-tests` (pgTAP/RLS) e testes Deno das edge functions verdes.

### 5. Observabilidade
Logs de push Auvo devem registrar o `CH-XXXX` usado como código externo. Alertar se uma OS for
criada sem `chamado_id` resolvido (caso da task importada — ver questão em aberto).

## Mapa de dependências
| Dependência        | Tipo     | Descrição                                  | Métodos / endpoints                    |
|--------------------|----------|--------------------------------------------|----------------------------------------|
| Auvo API           | REST     | Task carrega `CH-XXXX` no código externo   | push de task / update external code    |
| `pcm.chamados`     | interna  | Fonte do `CH-XXXX`                          | `numero`                               |
| `pcm.ordens_servico`| interna | Passa a referenciar `chamado_id`            | —                                      |

## Alternativas consideradas
| Alternativa                                   | Prós | Contras | Por que (não) |
|-----------------------------------------------|------|---------|---------------|
| A (escolhida) OS herda `CH-XXXX`, sem número próprio | 1 ID ponta a ponta, alinhado ao negócio | reverte S88, mexe em Auvo/UI | escolhida — é o pedido explícito |
| B Manter `OS-XXXX` e só ligar ao chamado      | menos mudança de código | mantém 2 números — não resolve o problema | rejeitada |
| C Renomear sequence para gerar `CH-` na OS    | reaproveita sequence | dois `CH` distintos (chamado e OS) confundem | rejeitada |

## Trade-offs e consequências
- Ganho: rastreio único, integração Auvo mais simples, alinhado ao mental model do Fabrício.
- Custo: retrabalho sobre E01-S88 (código recém-escrito) e ajuste de todos os pontos que exibem/geram
  `OS-XXXX`. Dívida: se S88 já estiver em produção, precisa plano de dados (não previsto no MVP).

## Riscos
| Risco                              | Descrição                                             | Prob. × Impacto | Ações / mitigações                          |
|------------------------------------|-------------------------------------------------------|-----------------|---------------------------------------------|
| S88 já em produção                 | OS numeradas `OS-XXXX` existentes em prod             | baixo × alto    | confirmar no ROADMAP antes; se sim, migration de dados |
| OS sem chamado de origem (Auvo)    | Task criada direto no Auvo não tem `CH-XXXX`          | médio × médio   | ver questão em aberto — decidir regra        |
| Testes de contrato Auvo quebram    | `os-from-task`/`contexto-tarefa-auvo` esperam `OS-`   | alto × baixo    | atualizar testes junto com o código          |

## Roadmap da feature
| Fase / onda | Entrega                                             | Quando | Depende de |
|-------------|-----------------------------------------------------|--------|------------|
| 1 (MVP)     | OS herda `CH-XXXX`; descontinua sequence/RPCs; Auvo usa código externo | próximo ciclo | confirmação S88 fora de prod |
| 2           | UI: substituir todos os rótulos `OS NNNN` por `CH-XXXX` | depois | 1 |

## Questões em aberto
- [ ] **S88 já rodou em produção?** Se sim, definir plano de dados para OS já numeradas. (Lucas)
- [ ] **OS importada do Auvo sem Chamado de origem:** cria-se um Chamado retroativo (`origem` nova?)
      para dar `CH-XXXX`, ou a OS carrega só a referência da task Auvo? (Lucas / @architect)
- [ ] Manter as RPCs como deprecated (retornam erro) ou dropar de vez? (define reversibilidade)

> Decisão difícil de reverter → **ADR-0014** (`docs/adr/0014-chamado-id-unico-remove-numeracao-os.md`),
> que substitui o racional de numeração de OS estabelecido em E01-S88.
