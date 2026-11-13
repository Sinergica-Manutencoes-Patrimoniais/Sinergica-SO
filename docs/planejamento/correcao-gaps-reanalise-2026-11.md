---
name: correcao-gaps-reanalise-2026-11
description: Ordem de execução e dependências das stories E01-S188 a S192 e E02-S42, abertas a partir da reanálise do Fabrício de 12/11/2026.
alwaysApply: false
---

# Correção dos gaps — reanálise de 12/11/2026

Seis stories abertas a partir da reanálise do Fabrício. Elas **não** adicionam funcionalidade
nova: fecham a distância entre o que existe no código e o que a operação consegue usar.

## O diagnóstico em uma frase

O repositório tem **585 gates de banco** e **737 flags `VITE_SSO_*`**. Uma funcionalidade só fica
utilizável quando três camadas coincidem — grant, gate e flag — e não existe nada que responda
"esta jornada está utilizável?". Daí a diferença medida pelo cliente entre **70–75% de código
preparado** e **35–45% de funcionalidade utilizável**.

## As seis stories

| Story | O que resolve | Bloqueada por |
|---|---|---|
| **E01-S188** Ativação governada | A causa raiz: registro das três camadas por jornada, diagnóstico e runbook de retorno | — |
| **E01-S189** Escritores sem gate | Sete funções implementadas e inalcançáveis; hoje falham com `permission denied` que parece bug | S188 só para o registro (FR-003) |
| **E01-S192** Agenda e Preventivas | Duas telas publicadas que não mostram o que deveriam. **Começa por diagnóstico** — a causa ainda não é conhecida | — |
| **E01-S191** Piloto vertical | A demonstração ponta a ponta de nove etapas que o cliente define como próximo marco | S188 (rollback), S192 (telas), 16.2-1 para a etapa Auvo real |
| **E01-S190** Onda Zero | Divergência em relação ao pedido: Assessment, PMOC, menu | **Aceite do Fabrício** (perguntas 26 e 27) |
| **E02-S42** Prévia simulada | Rota com dado simulado presente no build de produção | Coordenar com quem conduz E02-S35..S41 |

## Ordem sugerida

1. **E01-S188** primeiro, sempre. Sem ela, cada correção das outras volta ao mesmo estado —
   entregue no código, invisível na operação. É também o que dá resposta às perguntas 4, 5, 6 e 7
   da reanálise.
2. **E01-S189** e **E02-S42** em paralelo. São independentes entre si e de baixo risco.
3. **E01-S192 US0** — só o diagnóstico. O resultado pode encolher a story pela metade, ou mostrar
   que é problema de ativação e não de interface. Decidir o resto depois de saber.
4. **E01-S191** quando S188 e S192 estiverem de pé.
5. **E01-S190** quando houver aceite. O cliente pede que venha **antes da abertura ampla de
   gates**, então se o aceite chegar cedo, ela sobe na fila.

## O que estas stories não cobrem

Três pendências reais que **não se resolvem com código**:

- **16.2-1 — prova de contrato do Auvo com credencial real.** É o que mantém o despacho T−24
  bloqueado. Nenhuma das seis stories destrava isso.
- **16.2-5 — homologação da matriz de permissões com usuários reais.** Um usuário por papel
  tentando acessar o que não é dele.
- **Decisões de navegação** (perguntas 26 e 27) e a definição do Cliente piloto.

## Convenções que valem para todas

- Migration só aditiva; nunca editar migration aplicada. Numeração sequencial sem pular.
- **A GitHub Integration do Supabase não roda migration dentro de transação** — só a CLI roda.
  O que precisa ser atômico vai num `do $$ ... $$` com DDL por `execute`. Ver o cabeçalho de
  `1842_E01-S167_transicao_1n_chamado_os.sql` e o aviso em `.squawk.toml`.
- Gate novo nasce fechado. Nenhuma destas stories abre gate em produção.
- RLS FORCE e pgTAP de permitido e negado em toda tabela nova.
- Dado de servidor passa por TanStack Query; `useEffect` buscando dado é recusado no review.
- Toda story só é "concluída" pelo critério 11 da reanálise: CI verde, migration aplicada no
  ambiente certo, gate e flag documentados com responsável e retorno, tela acessível pelo perfil,
  E2E com dados de cliente piloto, e aceite registrado.
