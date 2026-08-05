---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Abertura de OS no Auvo sob demanda (dry-run + confirmação)

> **Fonte da verdade.** Tier arquitetural — ver [product](product.md), [design](design.md),
> [ADR-0015](../../docs/adr/0015-abertura-os-auvo-sob-demanda.md). Origem: Lucas (2026-08-04, item 6).

## Resumo
A criação automática de task no Auvo (trigger ao entrar em Planejamento) é **desligada**. A abertura
passa a ser **ação explícita** do operador, sempre precedida de um **dry-run** que mostra os campos
que serão enviados. Dois gatilhos: (a) ao mover pra Planejamento, pergunta; (b) botão "Abrir OS
Auvo" no painel. Idempotente: nunca duplica.

## Critérios de aceite

### AC-1: Automático desligado
- **Dado** uma OS que muda de status para `planejamento`
- **Quando** a transição ocorre
- **Então** **nenhuma** task é criada no Auvo automaticamente (o trigger não existe mais).

### AC-2: Pergunta ao mover pra Planejamento
- **Dado** o operador movendo um card/OS pra Planejamento (com permissão de escrita)
- **Quando** o drop/ação acontece
- **Então** aparece um modal "Abrir OS no Auvo?" mostrando o **dry-run** dos campos de abertura
  (cliente, técnico, data, tipo, orientação, local/endereço, prioridade).

### AC-3: Confirmar cria; recusar deixa sem task
- **Dado** o modal de dry-run aberto
- **Quando** o operador confirma
- **Então** a task é criada no Auvo e `auvoTaskId` é gravado na OS.
- **Quando** o operador recusa/fecha
- **Então** a OS permanece em Planejamento **sem** task Auvo, e pode ser aberta depois pelo botão.

### AC-4: Botão "Abrir OS Auvo" sempre disponível quando falta task
- **Dado** um Chamado/OS com `auvoTaskId === null`
- **Quando** o operador abre o painel
- **Então** há um botão "Abrir OS Auvo" que roda o mesmo dry-run → confirma → cria.

### AC-5: Dry-run não cria nada
- **Dado** o dry-run (modo dele)
- **Quando** roda
- **Então** nenhuma task é criada no Auvo e nada é gravado — só retorna os campos pra conferência.

### AC-6: Idempotência
- **Dado** uma OS que **já** tem `auvoTaskId`
- **Quando** o botão/pergunta é acionado
- **Então** não cria outra task — informa que já existe (e leva pro `Auvo #<id>`, E01-S120).

### AC-7: Falha ao criar não corrompe estado
- **Dado** que a criação no Auvo falha (rede/erro API)
- **Quando** o operador confirmou
- **Então** a OS continua no PCM (status intacto), o vínculo fica "sync pendente" (E01-S123), o erro
  é legível (`edge-function-error`), e o botão continua disponível pra retentar.

## Casos de borda e erros
- OS sem cliente Auvo resolvido / sem técnico: o dry-run mostra o campo faltando e a criação é
  bloqueada com mensagem clara (não manda payload inválido pro Auvo).
- Outros produtores de task (Zé/WhatsApp/portal): auditar (ver design/riscos) — se dependiam do
  trigger, migram pro caminho explícito ou mantêm caminho server-side próprio (documentar).

## Fora de escopo
- Editar a task após criada (E01-S121).
- Configuração "auto on/off" (design alternativa B, rejeitada por ora).

## Rastreabilidade
- Banco: migration remove/desativa trigger `fn_auvo_create_task_on_planejamento`.
- Edge: `supabase/functions/_shared/auvo/os-from-task.ts` (payload), nova/estendida função de
  abertura com `dryRun` (ex.: `pcm-auvo-open-task`), `pcm-auvo-push`.
- Código: `pages/OrdensServicoPage.tsx` (modal ao planejar + `DetalheOs`), `components/ChamadoPainel.tsx`
  (botão), `application/hub-os.ts`, `lib/http/edge-function-error.ts`.
- Estende/interage: E01-S124 (mover Solicitação→Planejamento), E01-S120 (Auvo #id), E01-S123 (saúde).
- ADR: 0015 (a criar).
