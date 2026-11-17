---
name: plan
description: Detalhe técnico de E01-S193 — transição do Backlog legado, schema e RPCs. Puxe ao implementar.
alwaysApply: false
---

# Plan — E01-S193 · Backlog antecede Chamado e OS

## Inventário (task 1, 17/11/2026) — achado que muda o escopo

Antes de supor que `sso_criar_chamado*backlog` não existe (suposição inicial deste `plan.md`),
inventariei por completo os 39 arquivos `sso_backlog*` (`0375` a `1832`). Achado principal:

- **`pcm.sso_promover_backlog_chamado`** (`0890_E01-S174_promocao_integral_chamado.sql`) **já
  existe e já cria Chamado novo a partir de uma composição de Pendências, sem OS** — exatamente a
  inversão de ordem que o Pacote Consolidado pede. Fluxo: `sso_backlog_composicoes` (sem
  `chamado_id`, `0375`) agrupa Pendências via `sso_backlog_pendencias`; a promoção gera
  `pcm.chamados` com `status='aberto'` (não precisa de status novo), cria uma parcela por
  Pendência (`sso_comando_escopo_chamado`) e vincula pelo par `0438`/`0441`. Idempotente por
  `request_id`, revisão otimista, `audit.events`, ADR própria (`ADR-0665`).
- **Por que parecia não existir:** meu grep anterior buscou `criar_chamado.*backlog` — o nome real
  é `promover_backlog_chamado`. Lição registrada aqui para não repetir o erro de busca.
- **Mas é só promoção INTEGRAL — não resolve AC-5 (liberação parcial).** A própria `ADR-0665`
  declara fora de escopo: *"não permite promover subconjunto"*. `sso_backlog_pendencias` exige
  todas as Pendências da composição no mesmo Chamado. AC-5 (*"resto continua no Backlog"*) ainda
  não tem RPC.
- **Fechada por 4 gates, nunca abertos, por desenho:** `sso_promocao_backlog_gate`,
  `chamado_os_gate`, `sso_backlog_chamado_gate`, `sso_backlog_parcela_gate` — todos
  `default false`, nenhum tem `update ... habilitado=true` em migration nenhuma. `ADR-0665` é
  explícita: *"Ordem global de locks, integrações/efeitos de gatilhos, autorização e concorrência
  exigem revisão adversarial e testes antes de habilitar."* Isso nunca aconteceu.
- **Front já escrito e também órfão:** `PromoverComposicao.tsx` chama a RPC certa, com
  idempotência de sessão, confirmação dupla e invalidação de query — mas é importado só por
  `Composicoes.tsx`, que por sua vez **não é importado por nenhuma página/rota**. Mesmo padrão
  medido em `docs/Apontamentos/alcance-no-front-2026-11-17.md`: regra pronta, zero alcance.
- **GUT no item de Backlog: inexiste, apesar do spec citar "7 migrations".** Busca por `\bgut\b`
  (case-insensitive) retornou só 4 arquivos: `0001` (coluna de schema), `0020` (GUT **da OS**
  legada, domínio diferente), `0174`/`0179` (GUT de **item de Inspeção**, domínio diferente). Nenhum
  é GUT de item de Backlog — AC-3 é novo, sem risco de 8ª migration duplicada.
- **Nenhum status `'demanda'` existe hoje** (`grep "'demanda'"` em `supabase/migrations` — zero
  resultados). O `plan.md` original presumia `pcm.chamados.status` sem CHECK; **errado** —
  `0134_E01-S88_chamados.sql` tem `check (status in ('aberto','convertido_os','backlog','cancelado'))`.
  Criar `'demanda'` exige `ALTER ... DROP CONSTRAINT / ADD CONSTRAINT` aditivo, não é "campo livre".

**Decisão de escopo — ADR-1689, decidida em 17/11/2026 (Opção B):** introduzir `'demanda'`.
`pcm.sso_liberar_escopo_backlog` (nova, fina) **chama** `sso_promover_backlog_chamado` (0890, sem
reescrever locks/idempotência/parcelas) e, só depois, transiciona `'aberto'→'demanda'`. Auditados
os 44 pontos que leem `chamados.status` (`grep` em `supabase/migrations`, 17/11): todos são
whitelist positiva (`status not in ('aberto','convertido_os')` etc.), nunca blacklist — `'demanda'`
entrar no `CHECK` não muda nenhum dos 44; um Chamado em `'demanda'` já não passa em nenhum deles
por construção (não vira OS, não é suspenso, não é unido) — a frase do `spec.md` *"só então o
Chamado admite OS"* fica verdadeira por omissão, zero RPC existente tocado. Transição
`'demanda'→'aberto'` é RPC própria, fora do escopo (cabe a `E01-S194`). Tabela nova: **nenhuma**.

## Os dois Backlogs, com endereço

| | Legado | Aprovado |
|---|---|---|
| O que é | **status da OS** | **escopo validado**, antes de existir OS |
| Onde vive | `pcm.ordens_servico.status='backlog'`; histórico em `0020_E01-S20_os_backlog_operacional.sql` | `pcm.sso_backlog_parcelas` com coluna `origem` (`1218`, `1219`, `1830`) |
| Quem consome | `STATUS_OS` em `apps/web/src/features/pcm/domain/ordens-servico.ts:127`, coluna do Kanban em `domain/kanban-colunas.ts`, tela "Backlog GUT" | `sso_criar_os_parcela_backlog`, `sso_consultar_parcelas_backlog`, `sso_devolver_parcela_chamado_backlog` |

`pcm.ordens_servico.status` é `text` **sem CHECK** (`0001_E00-S00_schemas_dominio.sql:68`). Isso
significa que nada no banco impede hoje um valor novo — e nada impede o valor legado voltar. A
guarda tem que ser **explícita**, em trigger/função, nunca presumida pelo tipo.

## Ordem da transição (o padrão que já funcionou na 1842)

1. Construir o caminho novo **aditivo**, com gate fechado por padrão.
2. Classificar o legado por decisão explícita, auditada, **sem apagar**.
3. Só então recusar o caminho antigo, pelo gate.

A `1842` fez exatamente isso para Chamado 1:N e é a referência de estilo, inclusive no cabeçalho
explicando o porquê de ser migration e não script manual.

## Schema — maquinário já existe quase inteiro (ver achado do inventário acima)

**Zero tabela nova.** `pcm.sso_backlog_composicoes`/`sso_backlog_pendencias` (`0375`) já são o item
de Backlog agrupado. Mapa AC → RPC existente:

| AC | RPC existente | Migration | Gate (fechado) |
|---|---|---|---|
| AC-1, AC-2 | `pcm.sso_compor_backlog_pendencias` | `0375` | `sso_backlog_composicao_gate` |
| AC-3 (GUTD no item, não na OS) | `pcm.sso_priorizar_composicao` | `0377` | `sso_backlog_composicao_gate` |
| AC-4 (integral) | `pcm.sso_liberar_escopo_backlog` (**nova**, fina — chama `0890` então transiciona p/ `'demanda'`) | `0890` + nova | `sso_promocao_backlog_gate` + `chamado_os_gate` + `sso_backlog_chamado_gate` + `sso_backlog_parcela_gate` |
| AC-5 (parcial) | **compor**: `pcm.sso_dividir_composicao_backlog` (separa subconjunto) **então** `sso_liberar_escopo_backlog` no destino | `0895` + 0890 + nova | `sso_divisao_backlog_gate` + os 4 acima |
| AC-6 (devolução) | `pcm.sso_devolver_parcela_chamado_backlog` — reusar, não reimplementar | `1830` | já coberto por `1830` |

RPC genuinamente **novo**: só `pcm.sso_liberar_escopo_backlog` (wrapper fino de `0890` + transição
de status) e o `ALTER CHECK` de `pcm.chamados.status`. O que falta, em ordem:

1. **Revisão adversarial de `0375`/`0377`/`0890`/`0895`/`1830`** (`ADR-0665`, `ADR-0670`,
   `ADR-0151` pedem isso explicitamente antes de abrir qualquer gate — nunca foi feita);
2. Migration: `ALTER TABLE pcm.chamados` CHECK aditivo incluindo `'demanda'` + `pcm.sso_liberar_escopo_backlog`;
3. **Abrir os 6 gates** por migration aditiva, só após a revisão;
4. **`grant execute`** nas funções que ainda não tiverem (conferir contra `1839_E01-S187`, que é a
   referência de "terceiro pilar de ativação" — flag + gate + grant — descoberta em 12/11/2026,
   achado idêntico ao que motivou `E00-S28` no front);
5. **Front:** `Composicoes.tsx`/`PromoverComposicao.tsx` já existem e já chamam as RPCs certas —
   faltam alcançáveis por rota/menu (igual ao achado do E00-S28); `StatusChamado`
   (`domain/chamados.ts:6`) ganha `"demanda"`.

**Atomicidade:** a GitHub Integration do Supabase roda migration **fora de transação** (diferente da
CLI local — lição da PR #78). Qualquer passo novo que precise de atomicidade vai em `do $$ ... $$`.

## Estado do Chamado na liberação — decidido, ver ADR-1689

`'demanda'` existe como valor de `pcm.chamados.status`, aditivo ao `CHECK` de `0134`. Auditoria dos
44 pontos que leem `status` em `supabase/migrations` (17/11/2026): 100% whitelist positiva — nenhum
precisa mudar. `E01-S194` escreve a RPC de transição `'demanda'→'aberto'`; esta story só precisa
criar o estado e provar (pgTAP) que nada nos 44 pontos aceita um Chamado em `'demanda'` por engano.

## Transição do legado — AC-7, AC-8

- Relatório **antes**: `scripts/inventariar-backlog-legado.mjs` conta OS em `status='backlog'`, por
  cliente, com e sem `auvo_task_id`.
- Classificação: cada OS legada vira item de Backlog **ou** permanece OS com estado próprio, por
  decisão registrada em `audit.*`. **Nunca deletar.**
- **Bloqueio obrigatório:** OS legada com `auvo_task_id`/`auvo_sync_status` **não pode** ser
  reclassificada sem reconciliação — mesmo padrão de `E01-S171` e de `1832`
  (`efeito_remoto_exige_reconciliacao`).
- Gate `pcm.sso_backlog_pre_chamado_gate`, `default false`.

### Procedimento de abertura e de retorno — AC-F4

- **Abertura:** (1) aplicar migrations; (2) rodar o inventário e revisar o relatório com o PCM;
  (3) classificar o legado; (4) `update ... habilitado = true` no gate, por migration aditiva;
  (5) declarar a flag do front em `FLAGS_SSO` e republicar.
- **Retorno:** fechar o gate (o caminho novo passa a recusar com `55000`), desligar a flag e
  republicar. A classificação já feita **permanece** — ela é aditiva e auditada, não destrutiva.
  Reverter classificação é operação à parte, por RPC de correção, nunca `delete`.

## Front

```
features/pcm/
  application/backlog-queries.ts          (novo)  TanStack Query + backlogQueryKeys
  interfaces/backlog/EnviarPendenciasBacklog.tsx  (novo)  AC-1, AC-2
  interfaces/backlog/PriorizarItemBacklog.tsx     (novo)  AC-3
  interfaces/backlog/LiberarEscopoBacklog.tsx     (novo)  AC-4, AC-5
  domain/ordens-servico.ts                (altera) `backlog` sai de STATUS_OS ao fim da transição
```

Dado de servidor **só** por TanStack Query, chaves em `backlogQueryKeys`, invalidação após escrita —
`useEffect` buscando dado de servidor é recusado no review.

### Alcance no front — AC-F1 a AC-F5

- **Caminho nomeado:** Trabalho → Central de Pendências → selecionar → "Enviar ao Backlog";
  Trabalho → Backlog (painel lateral do Kanban) → priorizar → "Liberar escopo".
- **Flag:** `VITE_SSO_BACKLOG_PRE_CHAMADO_ENABLED`, declarada em `FLAGS_SSO` (`E00-S28`) no mesmo
  PR, padrão `false`, com `gate: 'pcm.sso_backlog_pre_chamado_gate'` preenchido.
- **Desligado se anuncia:** usar `RecursoNaoAtivado` (`E00-S28`); `return null` é recusado no review.
- **AC-F5:** o PR declara em uma linha o que falta para a jornada ficar utilizável.

## Riscos

- Criar a oitava migration de GUT sem inventariar as sete existentes.
- Criar tabela nova quando `sso_backlog_parcelas` já serve — repetiria o erro registrado em
  `docs/STATE.md` (2026-11-11), onde uma migration duplicava sistema existente e foi apagada antes de aplicar.
- Mexer em `STATUS_OS` antes da classificação do legado terminar: quebra tela em produção.
