---
name: plano-execucao-2026-11-17
description: Ordem de execução das stories abertas pelo Pacote Consolidado do Fabrício e pela medição de alcance no front.
alwaysApply: false
---

# Plano de execução — 17/11/2026

Duas entradas geraram este plano:

1. **Pacote Consolidado SSO v1.0** (Fabrício, 13/11) + as respostas 26/27 (17/11) — confronto em
   `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.
2. **Medição de alcance no front** (17/11) — `docs/Apontamentos/alcance-no-front-2026-11-17.md`:
   694 flags nunca declaradas, 227 `return null` silenciosos, 583 gates fechados contra 1 aberto.

A segunda muda a ordem da primeira. Não adianta entregar regra nova enquanto o que já existe não
chega à tela: foi assim que Chamado 1:N ficou fechado em produção (`1842`) sem botão.

## Regra transversal (já inserida em 14 specs)

Toda spec pendente ganhou a seção **"Alcance no front — obrigatório nesta story"**, com cinco
critérios que entram no Definition of Done: caminho de navegação nomeado no `plan.md` (AC-F1), flag
declarada no mesmo PR (AC-F2), recurso desligado que se anuncia em vez de sumir (AC-F3), gate novo
com procedimento de abertura **e** retorno escritos antes de existir (AC-F4), e uma linha no PR
dizendo o que falta para a jornada ficar utilizável (AC-F5).

Specs tocadas: `E00-S26`, `E00-S27`, `E01-S188`, `E01-S189`, `E01-S190`, `E01-S191`, `E01-S192`,
`E01-S193`, `E01-S194`, `E01-S195`, `E01-S196`, `E01-S197`, `E01-S198`, `E02-S43`.

## Ondas

### Onda 1 — começa agora (`plan.md` e `tasks.md` escritos)

| Story | Por que primeiro | Paralelizável? |
|---|---|---|
| **E00-S28** Ativação visível no front | Para o sangramento. Sem ela, toda story seguinte repõe o problema. Entrega o `RecursoNaoAtivado` e o registro `FLAGS_SSO` que as outras consomem | Tasks 1–7 são independentes; lotes 8–13 por domínio |
| **E01-S190** Onda Zero, navegação | O Fabrício pediu explicitamente que a simplificação venha **antes** de abrir gates e de telas novas. Desbloqueada em 17/11 | Sim — toca `app/`, não colide com S28 se S28 começar pelos lotes do PCM |
| **E01-S193** Backlog antecede Chamado | É o P0 de domínio que destrava `E01-S194` e `E01-S197` | Sim — toca banco e `features/pcm/interfaces/backlog/` |

**Dependência real entre elas:** `E01-S193` task 16 consome o `FLAGS_SSO` de `E00-S28` task 2. Se
S193 chegar lá antes, cria a entrada no registro e segue — não espera a S28 inteira.

### Onda 2 — depois da Onda 1

| Story | Depende de |
|---|---|
| **E00-S26** Capacidades sensíveis | `E00-S09`, `E01-S170` (ambas existem) |
| **E00-S27** Revogação imediata | `E00-S26` — **exposição de segurança aberta hoje**; não deixar escorregar para a Onda 3 |
| **E01-S194** Kanban aprovado | `E01-S193` + `E00-S26` (capacidade `validar`) |
| **E01-S196** Gatilho único Auvo | validação do contrato real da API Auvo + `E00-S26` |

### Onda 3

`E01-S195` (deslocamento) e `E01-S197` (pendências por ativo) — independentes entre si, nenhuma
bloqueia outra.

### Onda 4 — P2 do pacote

`E01-S198` (API de domínio) e depois `E02-S43` (MCP, bloqueada até a S198 homologada).

### Fora de onda, já abertas

`E01-S188` (diagnóstico do servidor) e `E01-S189` (grants) podem andar em paralelo a qualquer onda.
`E01-S191` (piloto Guainumbi) é a prova da jornada e faz sentido **depois** da Onda 2.
`E01-S192` (Agenda/Preventivas) cobre o BL 003 e entra quando houver banda.

## Não implementar — por decisão do próprio pacote

Estrutura Técnica final, Relatórios e Área do Cliente, indicador de pressão do Backlog, visão do
síndico e QR Code do condomínio estão **Em validação**. Cockpit é **Próxima rodada** e o pacote diz
que **não bloqueia P0 e P1**. Estoque completo e técnico como usuário do SSO são **obsoletos** nesta
fase.

## Como o Sonnet deve trabalhar cada story

1. Ler `CLAUDE.md`, `docs/STATE.md`, a linha da story no ROADMAP (`grep -n "E0N-S0N" docs/epics/ROADMAP.md`)
   e o `spec.md`. **Não ler o ROADMAP inteiro.**
2. Marcar o **owner** na linha do ROADMAP antes de codar. Uma story, um owner.
3. Branch `feat/E0N-S0N-descricao`. **Nunca `git push origin main`.**
4. Seguir `tasks.md` **na ordem**, uma task por vez, rodando o comando da coluna *Gate* antes de
   marcar `done`. Task sem gate verde não vira `done`.
5. **Task 1 de toda story de domínio é inventário**: conferir o que já existe antes de escrever
   migration. O erro registrado em `docs/STATE.md` (2026-11-11) foi exatamente este — uma migration
   nova duplicando sistema existente, apagada antes de aplicar.
6. Migration: sequência sem pular; `do $$ ... $$` quando precisar de atomicidade (a GitHub
   Integration do Supabase roda migration **fora de transação**); `grant execute` no **mesmo
   arquivo** da função.
7. Dado de servidor **só** por TanStack Query. `useEffect` buscando dado de servidor é recusado.
8. Divergiu da spec? `// SPEC_DEVIATION: <motivo>` no código **e** em `tasks.md`. Nunca silencioso.
9. Antes do PASS em story arquitetural: `/revisao-adversarial`. Achado reproduzido vira teste.
10. Ao pausar: `/handoff`.

## O que continua sendo decisão do Lucas, não do agente

- **Abrir gate ou ligar flag em produção.** Nenhuma story destas abre gate por conta própria.
- Ativar Chamado 1:N (flag `VITE_SSO_CRIAR_OS_CHAMADO_ENABLED` + `pcm.chamado_os_gate` +
  `pcm.sso_criacao_os_mediada_gate`) — item 6 de `docs/Apontamentos/alcance-no-front-2026-11-17.md`.
- Mergear `E01-S188` (PR #83) para destravar `E01-S189` (PR #84).
- Pendências soltas: limpar a OS de teste `PRE-C393949B` em produção; investigar
  `23502 null value in column "cliente_id"` no sync do Auvo; revogar o token `sbp_...`.
