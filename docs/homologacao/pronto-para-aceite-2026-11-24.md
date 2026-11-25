---
name: pronto-para-aceite-2026-11-24
description: Lista de aceite da rodada de 24/11/2026 — os sete roteiros ligados para homologação, o que está desligado de propósito e o que precisa de decisão antes de entrar.
alwaysApply: false
---

# O que está pronto para aceite — rodada 24/11/2026

Substitui, para esta rodada, a separação de `pronto-para-aceite-2026-11-19.md` (que continua
válida como histórico). A diferença é que agora **a ativação já foi feita**: o commit `acf5f0b4`
(`chore(E00-S28)`) declarou as flags no `netlify.toml`, as travas de banco correspondentes foram
abertas no mesmo dia, e as 25 capacidades sensíveis foram concedidas ao administrador.

> Lembrete que custou caro descobrir: **ser `superadmin` não dispensa concessão** nesta base
> (`config.sso_autorizar_acao`, migration 0239). Flag ligada + gate aberto **sem** concessão =
> tela recusando por falta de permissão. Ver `capacidades-sso-2026-11-24.md`.

## A. Ligado e pronto para aceite em tela

| # | Story | Flag | Gate de banco | Onde na tela | Escreve no Auvo? |
|---|---|---|---|---|---|
| 1 | `E01-S199` Campo a conciliar | `VITE_SSO_CAMPO_A_CONCILIAR_ENABLED` | `pcm.sso_consulta_estado_campo_gate` | Kanban de OS (`OrdensServicoPage`) | **não** — só leitura |
| 2 | `E01-S194` Validação PCM | — (sem flag) | — | Kanban: retorno "Finalizada" do Auvo cai em **Validação PCM** | não |
| 3 | `E01-S201` Monitor Auvo T−24 | `VITE_SSO_MONITOR_EXCECOES_AUVO_ENABLED` | — | `MonitorExcecoesAuvoPage` | **não** — lê a fila com `left join`, nunca enfileira |
| 4 | `E01-S202` Agenda do Técnico | `VITE_SSO_AGENDA_PROJECAO_VISITA_ENABLED` | `pcm.capacidade_agenda_tecnico_gate` | `AgendaTecnicoPage` | não |
| 5 | `E01-S200` Matriz de movimentações | `VITE_SSO_MATRIZ_TRANSICOES_ENABLED` | — | `OsKanbanView` | não — só **restringe** movimentação manual |
| 6 | `E01-S190` Navegação por função + Diagnóstico Inicial | `VITE_SSO_NAVEGACAO_POR_FUNCAO_ENABLED` + `VITE_SSO_ASSESSMENT_COMO_INSPECAO_ENABLED` | migrations 1868/1869 (já aplicadas) | Menu Trabalho · Gestão · Administração; Inspeções → Diagnóstico Inicial | não |
| 7 | `E01-S195` Trechos de deslocamento | `VITE_SSO_TRECHOS_DESLOCAMENTO_ENABLED` + `VITE_SSO_CAPACIDADE_AGENDA_ENABLED` | `pcm.sso_trechos_deslocamento_gate` | Visão 360 → Estrutura → aba "Capacidade e Agenda" | não — escreve só em tabela própria do SO |

`VITE_SSO_CAPACIDADE_AGENDA_ENABLED` entrou declarada pela primeira vez nesta rodada: é o contêiner
da aba onde os Trechos vivem. Sem ela, ligar os Trechos não traz tela nenhuma, porque o bloco
inteiro não renderiza.

**Nenhum dos sete escreve no Auvo.** Conferido arquivo por arquivo antes de ligar.

## B. Aceite com pendência registrada — matriz do Kanban

O Fabrício aceita a matriz no quadro. Ficam registradas como pendência, não como entrega:
seletor, detalhe, ações em lote e aplicação no banco. O retorno automático do Auvo continua
funcionando por desenho — a matriz restringe só a movimentação **manual**.

## C. Pronto no código, **desligado** de propósito

### `E01-S203` — Plano PMOC criado à mão pelo PCM
`VITE_SSO_PLANO_PMOC_MANUAL_ENABLED = "false"` (`netlify.toml:25`). Migration `1871` aplicada.

O bloqueio **não é a flag**. A RPC `pcm.sso_criar_plano_do_contrato_pmoc` reusa, de propósito,
`pcm.sso_conferir_pmoc_mediado` (migration `1630_E01-S166`), que exige **dois gates
compartilhados**, ambos fechados por padrão:

- `pcm.sso_pmoc_mediado_gate`
- `pcm.sso_diagnostico_pmoc_gate`

**O que mais abre junto, se abrirmos esses dois:** a jornada PMOC mediado de `E01-S166` —
precondições de vínculo PMOC (`0515`) e proposta de mapeamento PMOC (`0518`) passam a responder.
**O que continua fechado:** a *decisão* da proposta (`0522`) depende de um terceiro gate,
`pcm.sso_decisao_pmoc_gate`, que permanece fechado e não precisa ser tocado.

Ou seja: o efeito colateral de abrir é **leitura e rascunho de PMOC mediado**, nunca decisão.
É reversível (os gates são tabelas de uma linha) e não escreve no Auvo.

Capacidade exigida: `plano.gerir` — **individual**, a mesma de `pcm.sso_salvar_plano_rascunho`.

### `Chamado 1:N` — várias OS por Chamado
Fica para rodada própria, com autorização expressa do Fabrício. Estado conferido hoje:

- a jornada tem **28 flags** registradas no inventário (`docs/ativacao/flags.md`);
- **nenhuma das 28 está declarada no `netlify.toml`** — portanto, mesmo com as travas de banco
  abertas pela PR #114, **nenhum caminho de criação de OS adicional está acessível pela interface**;
- só duas têm gate de banco nomeado e conferido: `VITE_SSO_CRIAR_OS_CHAMADO_ENABLED`
  (`pcm.sso_criacao_os_mediada_gate`) e `VITE_SSO_CONVERSAO_INTEGRAL_ENABLED`
  (`pcm.chamado_os_gate`);
- é a única jornada cujo efeito **sai do SO**: cada OS vira tarefa no Auvo quando a Visita é
  confirmada. Por isso o controle de ativação precisa ser flag + gate + concessão, nos três.

Demonstração exigida antes de liberar (teste em `Sinérgica – Escritório`): Chamado com duas OS,
uma tarefa Auvo por OS; envio em T−24; liberação imediata quando a confirmação ocorre dentro das
24 h; reprogramar OS já enviada atualiza **a mesma** tarefa; encerrar uma OS mantém o Chamado
aberto até a conclusão do escopo.

## D. Depende de decisão da Engenharia Sinérgica

| Item | O que falta |
|---|---|
| Plano PMOC manual | Autorizar a abertura dos dois gates compartilhados e marcar a janela |
| Chamado 1:N | Autorização expressa + demonstração acima |
| Clientes e Estrutura / Visão 360 | Escopo da próxima entrega: pesquisa que identifica o tipo do resultado, visão por local e por sistema |
| Materiais e Aquisições | Prazo da entrada única no menu |
| `execucao.validar` nominal | Hoje é herdável por perfil, com teste que prova o acúmulo. Tornar individual quebra contrato testado |

## E. O que a Trívia ainda precisa entregar para a sessão de aceite

1. Endereço e versão publicada do ambiente de homologação.
2. Login de teste por perfil (Gestor PCM, Operador PCM, Inspetor, Financeiro, Comercial).
3. Registros de exemplo por roteiro — em especial uma OS de origem Auvo **sem Chamado válido**
   (roteiro 1) e uma OS retornada como concluída pelo Auvo (roteiro 2).
4. Registro de resultado, evidência e pendência por teste, durante a sessão.
