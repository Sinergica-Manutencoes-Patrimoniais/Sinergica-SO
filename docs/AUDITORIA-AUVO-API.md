---
name: AUDITORIA-AUVO-API
description: Auditoria API Auvo v2 × PCM (10-07-2026) — inventário completo dos 142 endpoints, o que o PCM já cobre, gaps com valor operacional, achados da conta real (módulos ativos/vazios) e as stories E01-S52..S58 que fecham os gaps. Puxe ao planejar qualquer feature que toque a integração Auvo.
alwaysApply: false
---

# Auditoria — API Auvo v2 × PCM (10-07-2026)

> **Objetivo.** Fabrício não deve precisar abrir o Auvo — o PCM é a porta única. O Auvo fica
> restrito ao app de campo do técnico e ao que a API não alcança. Esta auditoria cruza o
> inventário completo da API (142 operações, spec OpenAPI 3.1 oficial em
> `developer.auvo.com.br/openapi/api-reference`) com o que o PCM já sincroniza, e com o **estado
> real da conta Sinérgica** (navegada logado em 10-07-2026).
>
> **Método:** (1) download e parse do OpenAPI YAML oficial; (2) auditoria do registry de sync
> (`supabase/functions/_shared/auvo/registry/`, 13 descriptors + tasks); (3) navegação autenticada
> em `app3.auvo.com.br` (read-only, screenshots em sessão) para confirmar módulos habilitados e uso
> real.

## 1. Estado real da conta Sinérgica (navegação 10-07-2026)

| Módulo Auvo | Estado na conta | Implicação para o PCM |
|---|---|---|
| Agenda/Tarefas | **Em uso intenso** (rondas diárias BRP, visitas, 5 técnicos ativos) | Já sincronizado (2.357 OS) ✅ |
| Monitoramento/GPS | **Ativo** — 5 técnicos com posição de alta precisão, bateria, versão do app | Gap: `/gps` não é consumido (E01-S52) |
| Ordens de Serviço ("Projetos") | **Vazio (0 registros)** — módulo existe, nunca usado | Chance: PCM pode nascer dono do preventivo recorrente (E01-S53) |
| Orçamentos | **Vazio (0 registros)** — módulo existe, nunca usado | Orçamento deve nascer no OS (Comercial/E03), sem migração — não espelhar |
| Pesquisa de satisfação | Configurável, **0 respostas** — nunca ativada | Gap dormente: espelho + ativação (E01-S55) |
| Questionários | Cadastro existe (checklists por tipo de serviço) | Gap: catálogo não espelhado (E01-S56) |
| Despesas / Tipos de despesa | Menu Financeiro presente | Gap: custo real por OS (E01-S54) |
| Km rodado / Apontamento de horas | Relatórios na UI | **Sem endpoint público** — proxy via GPS + check-in/out |
| Serviços (`/servico`) | Existe na UI | API `/services` deu 404 nos testes — reverificar com credencial API (pode ser permissão do token, não do plano) |
| AuvoDesk / AuvoChat | Produtos à parte | Fora de escopo — Atendimento do OS cobre |

**Tipos de tarefa reais da conta** (amostra): SPDA, Corretiva, Ar-Condicionado, Bomba Hidráulica,
BRP Ronda Semanal, Luggo Ronda Diária, Extintor, Hidrante, Quadro Elétrico, Levantamentos,
Atendimento Emergencial, Conferência Ferramentas — confirma o catálogo do PCM v2 (§6.1 do
ESCOPO-MESTRE).

## 2. Inventário da API × cobertura do PCM

### Já coberto (motor de sync, 13 descriptors + tarefas)
`/customers` (+grupos) · `/users` (+create dedicado) · `/teams` · `/equipments` · `/products`
(ferramentas + `employee-product-stock`) · `/productcategories`* · `/equipmentcategories` ·
`/tasktypes` · `/segments` · `/keywords` · `/services`* · `/tickets` (+request-type/status) ·
`/tasks` (import→OS, webhook, criação básica, snapshot rico) · `/webhooks` (registro).
*404 na conta nos testes anteriores — reverificar.

### Disponível na API e NÃO consumido — com valor operacional

| API | Ops | O que dá | Valor / dor | Story |
|---|---|---|---|---|
| `/gps` | GET | Posições (lat/long, precisão, bateria, data) por técnico | Dor L5 "onde está minha equipe"; mapa do dia; base de produtividade §6.11 | **E01-S52** |
| `/serviceorders` | GET/POST/PATCH | OS-mãe com **recorrência nativa** (daily/weekly/monthly/yearly), questionário default, responsável, prioridade, anexos | Espinha do **Preventivo/PMOC** (§6.1, §9) sem cron caseiro | **E01-S53** |
| `/expenses` + `/expensetypes` | CRUD + anexos | Despesas do técnico/tarefa (combustível, material, refeição) com anexo de comprovante | Custo real por OS → rentabilidade por contrato (dor L2) | **E01-S54** |
| `/satisfactionsurveys` | GET | Respostas de pesquisa por `taskId` (score, comentário, e-mail) | NPS/CSAT por OS/cliente; alimenta churn (§6.11) e relatório mensal | **E01-S55** |
| `/questionnaires` | GET | Catálogo de questionários (checklists) e perguntas | Checklist esperado × respondido; base da auditoria de qualidade (F6 §14) | **E01-S56** |
| `/tasks/{id}/attachments` `/tasks/{id}/products` `/tasks/{id}/services` `/tasks/{id}/additional-costs` | PUT/DELETE | Enriquecer a tarefa criada: anexo de contexto, peças previstas, serviços, custos | Técnico recebe OS **com histórico/peças** (dor T1/T3); custo previsto | **E01-S57** |
| `/tasks/GetDeletedTasks` | GET | Tarefas excluídas no Auvo | OS órfã local nunca é cancelada hoje — fura KPI de abertas | **E01-S58** |
| `/customers/complete` + `/customers/{id}/attachments` | POST/PUT | Cliente completo + anexos (contratos, documentos) | Enriquecer S51/gestão documental — absorver em E01-S47/S51 quando a escrita destravar | — |
| `/quotations` (12 ops) | CRUD completo | Orçamentos com serviços/produtos/custos | Conta nunca usou → **orçamento nasce no OS** (motor §6.3, épico E03); não espelhar módulo vazio | decisão registrada |
| `/receivables` `/invoices` `/financialcategories` `/paymentmethods` `/additionalcosts` | CRUD parcial | Financeiro Auvo | **Decisão mantida (jul/2026): descartado** — ciclo financeiro será do OS (§6.5, Fase 3); reavaliar só se a operação começar a lançar financeiro no Auvo | — |
| `/expensetypes`, `/teams` POST | write | Criação de cadastros de apoio | Cobertos pelo motor genérico quando `writeEnabled` destravar (E01-S47) | — |

### Sem endpoint público (continua exigindo Auvo UI)
- **Km rodado** e **Apontamento de horas** (relatórios) — proxy possível: GPS (E01-S52) +
  check-in/out (já capturado).
- **Motivo de pausa**, **Configurações gerais**, envio de **OS digital / pesquisa por e-mail**
  (ações da UI), **roteirização nativa** (`/roteiroDeTarefas`) — a nossa roteirização é §6.11
  (Google Maps), não a do Auvo.
- **AuvoDesk / AuvoChat** — produtos separados, sem API no spec público.

## 3. O que o Fabrício ainda precisaria do Auvo (alvo: nada no dia a dia)
Depois de E01-S52..S58 + E01-S47 (escrita real):
1. **Nada operacional** — abrir/planejar/acompanhar OS, preventivo, equipe, GPS, custo, satisfação:
   tudo no PCM.
2. Restam apenas ações administrativas raras: configurações gerais da conta Auvo, gestão de
   licenças/cobrança, motivo de pausa e o disparo de e-mails nativos (se usados).

## 4. Stories abertas por esta auditoria
Ver `docs/epics/ROADMAP.md` (E01-S52 a E01-S58, owner livre). Ordem sugerida de valor:
**S52 (GPS)** → **S53 (preventivo — tier arquitetural, design antes)** → **S54 (custo real)** →
**S58 (excluídas — trivial)** → **S56 (questionários)** → **S55 (satisfação)** → **S57 (task rica)**.

> **Pré-requisito transversal:** credencial de API (`AUVO_API_KEY`/`AUVO_USER_TOKEN`) disponível
> para o dev verificar contrato real de cada endpoint novo antes de gravar schema — mesma lição do
> `taskID`/`smartPhoneNumber` (E01-S34/S47). O login de UI usado nesta auditoria não serve para a API.

## 5. Roteiro de execução para a sessão dev (Codex/Claude) — contrato obrigatório

> **Princípio do produto (decisão do Lucas, 10-07-2026): toda ação operacional é feita via PCM, e o
> sync entre PCM e Auvo deve ser perfeito.** O Auvo UI fica para o técnico em campo e para as raras
> ações administrativas do §3. Nenhuma story pode terminar orientando o usuário a "fazer no Auvo".

### Pré-condição dura (vale para TODAS as stories S52–S58 e S47)
- `AUVO_API_KEY`/`AUVO_USER_TOKEN` presentes no ambiente da sessão. **Sem credencial → parar, marcar
  bloqueio no tasks.md/STATE e devolver ao Lucas. Nunca inventar payload/schema a partir só da doc**
  (a doc já divergiu da API real: `taskID`, `smartPhoneNumber`, preço string).

### Ordem de execução recomendada
1. **E01-S47 primeiro** (habilitar escrita real, entidade a entidade) — é ela que materializa o
   "toda ação via PCM": sem `writeEnabled`, edição de cliente/ferramenta/funcionário continua
   morrendo local. Já tem `design.md` com a avaliação por entidade. **Inclui ajuste de UI:** ao
   habilitar cada entidade, remover/adaptar o `BannerEscritaAuvoPendente` (E01-S46) das telas
   daquela entidade e o texto do banner da 360 (E01-S50) — a UI deve sempre dizer a verdade sobre
   o estado do sync, nos dois sentidos.
2. Espelhos de leitura em qualquer ordem: **S52 (GPS) → S54 (despesas) → S58 (excluídas) →
   S56 (questionários) → S55 (satisfação)**.
3. **S53 (preventivo)** — tier arquitetural: teste de contrato + `design.md` + ADR antes de codar.
4. **S57 (tarefa rica)** por último (depende de tarefa de teste e do formato real de anexo).

### Regras de "sync perfeito" (obrigatórias em toda story nova; o motor já as implementa — reusar)
- **Idempotência sempre**: upsert por chave natural (`auvo_id`/`externalId`); reprocessar nunca duplica.
- **Anti-eco**: escrita inbound (Auvo→PCM) só via RPC anti-loop (`fn_upsert_auvo_sync`/
  `fn_apply_auvo_sync`) para não re-enfileirar outbox; nunca `UPDATE` direto na tabela espelhada.
- **Outbound**: toda escrita PCM→Auvo passa pelo outbox + push instantâneo (E01-S36) ou por Edge
  Function dedicada idempotente — nunca fetch solto no front.
- **Verificação pós-write**: após habilitar escrita de uma entidade, fazer GET do registro criado/
  editado no Auvo e comparar campo a campo antes de declarar AC verde (teste de contrato vivo).
- **Reconciliação como rede**: cron/`sync-all` continua cobrindo o que webhook perder; exclusões
  cobertas por S58.
- **Falha parcial visível**: erro de etapa não aborta o resto e aparece na UI/`auvo_sync_health` —
  nunca silencioso.
- **Gates**: `pnpm run ci:local` + pgTAP das tabelas novas + teste manual com dado real antes de
  fechar AC (memória do projeto: gate de código não prova UI).
