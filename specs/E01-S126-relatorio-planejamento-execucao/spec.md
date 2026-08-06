---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Relatório de planejamento e execução (por dia / técnico / cliente)

> **Fonte da verdade.** Origem: pedido do Lucas (2026-08-04, item 7, com exemplo). Decisões
> travadas: saída = **tela + texto copiável (WhatsApp) + PDF**; fonte = **Agenda do Técnico ∪ OS em
> Planejamento** (com dedupe).

## Contexto de código
- **Agenda do Técnico** (E01-S104/S112): `AgendaTecnicoPage`, `pcm.agenda_tecnico` (técnico +
  cliente + dia + `hora_inicio`/`hora_fim`).
- **OS em Planejamento**: `pcm.ordens_servico` com `status='planejamento'`, `data_planejada`,
  `tecnico_funcionario_id`, `client_id` — já lidas pelo board da Operação (`hub-os`).
- **Evidência de execução**: a volta do Auvo traz status/execução (`pcm-auvo-webhook`, snapshots
  E01-S15) + `auvoTaskId` → deep-link `app.auvo.com.br/informacoes/tarefa/<id>` (a "OS Evidência").
- Geração de PDF já tem stack no projeto (`pdf-lib`, laudo PMOC E01-S05).

## Formato-alvo (do exemplo do Lucas)
```
Planejamento - <Cliente> - <dd/mm>
Técnico - <Nome>
1º - <item>
2º - <item>
...

Relatório - <Cliente> - <dd/mm>
Técnico - <Nome>
1º - <item>
• Status: Executado
OS Evidência: <link Auvo>
```

## Resumo
Uma tela de **Relatório** com filtros **dia / técnico / cliente**. Dois modos: **Planejamento** (o
que está agendado, numerado 1º,2º,3º…) e **Relatório de execução** (mesma lista + status de cada
item + link da OS no Auvo como evidência). Saída: renderiza na tela, botão **Copiar** (texto no
formato exato pra colar no WhatsApp) e botão **Baixar PDF**.

## Critérios de aceite

### AC-1: Filtrar por dia, técnico e cliente
- **Dado** a tela de Relatório
- **Quando** o operador escolhe dia + técnico (e opcionalmente cliente)
- **Então** vê a lista de itens daquele recorte, numerada em ordem (1º, 2º, …).

### AC-2: Fonte unificada Agenda ∪ OS planejadas, sem duplicar
- **Dado** um dia/técnico que tem tanto item na Agenda quanto OS em Planejamento
- **Quando** o relatório monta a lista
- **Então** une as duas fontes e **remove duplicata** (mesmo cliente/local/serviço aparece uma vez).

### AC-3: Modo Planejamento (texto do exemplo)
- **Dado** o recorte selecionado
- **Quando** o operador gera o Planejamento
- **Então** o texto sai no formato "Planejamento - Cliente - dd/mm / Técnico - Nome / 1º - item…".

### AC-4: Modo Relatório de execução com evidência
- **Dado** itens que já têm OS no Auvo executada
- **Quando** o operador gera o Relatório de execução
- **Então** cada item mostra "Status: <estado>" e "OS Evidência: <link Auvo>" quando houver
  `auvoTaskId`; item sem execução mostra status pendente sem link.

### AC-5: Copiar e PDF
- **Dado** um relatório gerado (planejamento ou execução)
- **Quando** o operador clica "Copiar"
- **Então** o texto no formato exato vai pro clipboard (pronto pro WhatsApp).
- **Quando** clica "Baixar PDF"
- **Então** baixa um PDF com o mesmo conteúdo formatado.

## Casos de borda e erros
- Recorte sem itens: estado vazio claro ("Nada planejado para este dia/técnico"), sem gerar texto/PDF vazio enganoso.
- Técnico sem nome resolvido: usa "Sem técnico"/fallback, nunca quebra.
- Ordenação dos itens: por horário (Agenda tem `hora_inicio`); OS sem hora vão depois, por prioridade/created.

## Fora de escopo
- Editar o planejamento por esta tela (é só leitura/relatório; edição é na Agenda/board).
- Enviar automaticamente pro WhatsApp (só copiar; envio é manual).
- Métricas/dashboard analítico (é relatório operacional do dia).

## Rastreabilidade
- Código: nova `pages/RelatorioPlanejamentoPage.tsx` (aba na Operação), `domain/relatorio-planejamento.ts`
  (união+dedupe+formatação do texto, domínio puro testável), `application/*`, adapters de Agenda
  (`supabase-agenda-*`) e OS (`hub-os`), gerador PDF (reusa `pdf-lib` do laudo PMOC).
- Fonte: E01-S104/S112 (Agenda), `hub-os` (OS planejadas), E01-S15 (execução Auvo), E01-S120 (deep-link).
- ADRs relacionados: —
