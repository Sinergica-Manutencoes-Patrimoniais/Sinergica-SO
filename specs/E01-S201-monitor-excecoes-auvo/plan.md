---
name: plan
description: "Inventário das três exceções do Auvo T−24 e desenho técnico da consulta consolidada de E01-S201."
alwaysApply: false
---

# Plan — E01-S201 · Monitor consolidado de exceções do Auvo (T−24)

## 1. Inventário (resultado da primeira tarefa, antes de qualquer código)

O objetivo do inventário era descobrir **onde cada uma das três exceções mora hoje** e se é
consultável. Resultado: as três existem, separadas, e **nada as reúne**.

### 1.1 Falha de envio ao Auvo

| O quê | Onde |
|---|---|
| Estado da tentativa | `pcm.sso_t24_tentativas.estado` — `bloqueado`, `incerto`, `reconciliacao` são os estados de parada (`1309` cria a tabela, `1310` grava o resultado conservador, `1311` promove `iniciado → incerto` por silêncio) |
| Motivo do erro | `pcm.sso_t24_tentativa_eventos.motivo` (append-only, imutável por trigger) — o último por `sequencia` |
| Nº de tentativas | `pcm.sso_t24_tentativas.fence`, incrementado a cada reserva (`sso_t24_reservar_candidata`) |
| Fila/erro bruto | `pcm.auvo_sync_outbox` (`status`, `attempts`, `last_error`), ligada por `sso_t24_tentativas.outbox_id` (`1316`) |
| ID externo | `pcm.ordens_servico.auvo_task_id` (gravado só na confirmação, `1343`) |
| RPC de leitura | **Não existia.** `1313` lista candidatas por Visita; `1312` diagnostica uma; nenhuma das duas é um monitor |

**Achado importante:** `auvo_sync_outbox.attempts` **nunca sai de 0** para essa família, porque
`fn_claim_auvo_outbox_batch` foi reescrita em `1316` para EXCLUIR `entity = 'ordens_servico_t24'`
(o drain genérico não pode consumir o que o T−24 reserva por fence). Quem conta tentativa é o
`fence`. Usar `attempts` aqui mostraria "0 tentativas" para toda falha — exatamente o erro que o
critério de BL 004 ("registrar ID externo, tentativas e erro") quer evitar.

### 1.2 Visita confirmada / não confirmada

| O quê | Onde |
|---|---|
| Confirmação | `pcm.visitas.estado` (`rascunho`, `planejada`, `confirmada`, …) e o recibo em `pcm.visita_confirmacoes` (`0291`) |
| "Deveria ter gerado tarefa" | `pcm.visita_ordens_servico` com `encerrado_em is null`: uma tarefa Auvo por OS vinculada vigente |
| Quando a janela abre | `inicio_em - interval '24 hours'` — a mesma conta que `1325`/`1330` gravam em `sso_t24_tentativas.elegivel_em` e que `1340`/`1341` revalidam |
| Por que não gera tarefa | Os produtores (`1325`, `1330`) exigem `estado = 'confirmada'`: sem isso, levantam `visita_obsoleta` e **nenhuma linha é criada no livro** |
| RPC de leitura | **Não existia — e não havia nem onde ser lida.** Esta é a única das três cuja exceção é a *ausência* de linha. Nenhuma tabela registra "esta Visita deixou de virar tarefa" |

### 1.3 Tarefa órfã

| O quê | Onde |
|---|---|
| Definição nesta base | OS criada pelo Auvo **sem ID de Chamado**: `1420` cria o par provisório (`pcm.sso_origem_campo_processamentos.provisorio = true`, com `motivo` e `task_id`) |
| Saída da condição | Decisão de triagem em `pcm.sso_triagem_chamado_campo_decisoes` (`1428`), ou união a outro Chamado (`1429`) |
| RPC de leitura | **Já existia:** `pcm.sso_listar_campo_a_conciliar` (`1866`, de E01-S199) — mesmo recorte, mesmo gate, mesma capacidade |

Existe ainda `pcm.sso_contar_orfaos_fila_admin` (`0698`), mas é outra coisa: conta linha de
`auvo_sync_outbox` de **sistemas/equipamentos** cuja origem sumiu, é global e administrativa, e
está atrás de dois gates próprios. Não é a "tarefa órfã" do pacote e não foi usada.

### 1.4 O que o inventário NÃO encontrou

- Nenhuma consulta consolidada das três famílias (confirmado pelo próprio comentário de `1863`).
- Nenhum registro de "Visita que deixou de virar tarefa" — essa família precisou ser **derivada**
  (Visita + vínculo de OS + janela), não lida de uma tabela.
- Nenhum campo de "última mensagem de erro" no livro de tentativas: o motivo é um código
  `^[a-z0-9_]{1,120}$` no evento, não o texto do Auvo. O texto cru só existe em
  `auvo_sync_outbox.last_error`, e só quando o drain genérico passou por ali.

## 2. Decisões técnicas

### 2.1 Reuso de gate e capacidade (AC-11)

Reusa `pcm.sso_consulta_estado_campo_gate` (de `1427`) e `config.sso_autorizar_acao('execucao.validar', cliente)`
— exatamente o que `1866` fez sobre `1427`. Motivos:

1. criar gate novo aumenta a superfície de ativação sem necessidade; quem abre a leitura do estado
   de campo abre a mesma jornada de integração Auvo, vista de outro ângulo;
2. a família "tarefa órfã" **é** a consulta de `1866`, que já depende desse gate — um gate próprio
   produziria o estado absurdo "monitor ligado, órfã desligada";
3. o gate de **execução** do T−24 (`pcm.sso_t24_execucao_gate`) seria a escolha errada: o monitor
   precisa funcionar justamente quando o despacho está travado.

### 2.2 Assinatura

```sql
pcm.sso_listar_excecoes_auvo_t24(p_ator_id uuid, p_cliente_id uuid, p_limite integer)
returns table(
  tipo text,              -- 'falha_envio' | 'visita_nao_confirmada' | 'tarefa_orfa'
  cliente_id uuid, cliente_nome text,
  visita_id uuid, visita_inicio_em timestamptz,   -- nulos em 'tarefa_orfa'
  os_id uuid, os_numero text,
  task_id bigint,         -- nulo quando a tarefa nunca existiu no Auvo — o nulo é a informação
  tentativas integer,     -- `fence` na falha de envio; 0 nas outras duas (nenhuma tentativa houve)
  ultimo_erro text,       -- código estável: motivo do evento, 'visita_<estado>' ou motivo de 1420
  ocorrido_em timestamptz
)
```

`security definer`, `set search_path = ''`, `volatile` (chama `1866`, que é volatile), travas na
mesma ordem de `1866`: isolamento → parâmetros → advisory lock compartilhado → gate → capacidade.
`p_limite` entre 1 e 50, porque é o que `1866` aceita e esta função repassa o valor.

Cada família é uma CTE com `limit p_limite`; a união recebe `limit p_limite` de novo e
`order by ocorrido_em desc, tipo, os_id` (determinístico).

### 2.3 Recortes de cada família

- **falha_envio:** `estado in ('bloqueado','incerto','reconciliacao')`. `confirmado` (1343) e
  `cancelado` (1332) ficam de fora — exceção é o que parou. `ultimo_erro` =
  `coalesce(último motivo do evento, outbox.last_error, 'sem_motivo_registrado')`.
- **visita_nao_confirmada:** `estado in ('rascunho','planejada')`, `inicio_em - 24h <= now()`,
  `fim_em > now() - 72h`, com vínculo de OS vigente e **sem** tentativa no livro (uma Visita que já
  produziu tentativa aparece, se for o caso, pela família de falha de envio).
  O corte de 72h é consciente: exceção de janela é operacional, não histórico — está anotado em
  `tasks.md` como limite desta fatia.
- **tarefa_orfa:** `select ... from pcm.sso_listar_campo_a_conciliar(p_ator_id, p_cliente_id, p_limite)`.
  Chamada de função, não cópia de predicado: "órfã" continua tendo **uma** definição. O advisory
  lock compartilhado é re-entrante na mesma transação, e o gate/capacidade conferidos lá são os
  mesmos já conferidos aqui.

### 2.4 Por que não converter `sso_t24_tentativas.tarefa_id` para `bigint`

O CHECK da tabela só limita tamanho (`length between 1 and 200`); o formato numérico é exigido
apenas em `sso_t24_confirmar_efeito`. Um cast no monitor faria **uma linha malformada derrubar a
leitura inteira**. O `task_id` devolvido vem de `pcm.ordens_servico.auvo_task_id`, que é `bigint`
de verdade. Tentativa de `criar` que falhou devolve `null` — e esse nulo é a informação.

## 3. Front

- `domain/excecoes-auvo.ts` — tipos, rótulos e `avisoMonitorExcecoes` (puro, testável): sete
  frases distintas para flag desligada, sem Cliente, gate fechado, sem capacidade, autorização em
  alteração, erro desconhecido e "nenhuma exceção".
- `infrastructure/supabase-operacao-adapter.ts` — `listarExcecoesAuvoT24`, com Zod `.strict()`.
- `application/operacao-queries.ts` — chave `operacaoQueryKeys.excecoesAuvo(clienteId)`.
- `pages/MonitorExcecoesAuvoPage.tsx` — TanStack Query, `retry: false`, tabela com as oito colunas
  do AC-2 e contadores por família no cabeçalho.
- `app/HomePage.tsx` — item "Monitor Auvo (T−24)" no grupo OPERAÇÃO do PCM.

## 4. Procedimento de abertura (AC-F4 de E01-S199, mesma disciplina aqui)

1. `VITE_SSO_MONITOR_EXCECOES_AUVO_ENABLED=true` no ambiente (hoje `false` em `.env.example` e
   `netlify.toml`).
2. `update pcm.sso_consulta_estado_campo_gate set habilitado = true where id;` — **atenção: este
   gate é compartilhado.** Abri-lo liga também a consulta de estado de campo (`1427`) e a fila
   "Campo a conciliar" (`1866`). É o preço consciente de não criar gate novo.
3. Conceder `execucao.validar` ao usuário no Cliente (`config.sso_concessoes`).

**Retorno:** fechar o gate (`habilitado = false`) ou desligar a flag. Nenhum dos dois apaga dado —
a consulta é só leitura. Reverso da migration no cabeçalho de `1867`.
