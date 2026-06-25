---
name: blueprint-pcm-operacao
description: Requirements do módulo PCM / Operação — núcleo do Sinérgica OS. Puxe ao planejar specs de OS, backlog, visitas ou inspeções.
alwaysApply: false
---

# Blueprint — PCM / Operação (módulo núcleo)

> Schema Postgres: `pcm` · Feature: `apps/web/src/features/pcm/`
> Specs SDD: `specs/0001-priorizacao-backlog-gut/` (implementado) · `specs/0002-abertura-chamado-ze/` (âncora)

## Problema
A Sinérgica não tinha sistema centralizado — OS espalhadas em WhatsApp, planilhas e Auvo sem
vínculo. Impossível saber o que está pendente, qual a criticidade, ou calcular o backlog de horas
por contrato.

## Personas
- **Gestor / Escritório**: cria, prioriza e acompanha OS; define cronograma de visitas.
- **Técnico de campo**: recebe tarefa no Auvo, executa e registra resultado.
- **Síndico/Zelador**: abre chamados (via Zé ou portal) e recebe relatórios.

## Entidades principais
| Entidade | Descrição |
|----------|-----------|
| `Cliente` | Condomínio atendido (CNPJ, endereço, contrato, grupo WhatsApp) |
| `Contrato` | Visitas/semana, horas/visita — base para indicador de saúde do backlog |
| `Backlog Item` | Item de manutenção com score GUT, categoria, esforço estimado |
| `Visita` | Agendamento técnico + data/turno + lista de itens do backlog a executar |
| `Ordem de Serviço (OS)` | Trabalho executável — categorias: corretiva, preventiva, inspeção, levantamento, emergencial |
| `Inspeção` | Vistoria completa com fotos e análise de IA por item; gera backlog automaticamente |
| `Plano Preventivo` | Equipamento + periodicidade + mês início → gera OS automaticamente |
| `Relatório Diário` | Consolidação das OS do dia por cliente, enviado via WhatsApp |
| `Relatório Mensal` | PDF do período — OS, preventivas cumpridas, SLA, NPS |
| `Laudo SPDA` | Documento técnico NBR 5419:2026 com cálculos de risco e recomendações |

## Fluxos e regras de negócio

### Backlog e Priorização GUT
- Score = `gravidade × urgência × tendência` (1–5 cada, máx 125).
- Ordenação padrão: score desc. Empate: mais antigo primeiro.
- Indicador de saúde do contrato: `horas_pendentes / horas_semana` → verde (<2 sem), amarelo (2–4), vermelho (>4).
- Faixas de prioridade: crítica ≥100, alta ≥50, média ≥20, baixa <20.
- IA pode sugerir repriorização em lote (modelo separado, não o Zé).

### Ciclo de OS (Kanban 6 status)
`solicitacao` → `corretiva/planejamento` → `em_execucao` → `finalizado` → (faturado/cancelado)
- Ao entrar em `planejamento`: criar Auvo Task via `pcm-auvo-create-task` com `externalId = os.id`.
- Auvo webhook retorna: status, fotos, checklist preenchido, peças consumidas.
- Idempotência: reenviar ao Auvo usa `externalId` — nunca duplica.

### Inspeção → Backlog
1. Técnico fotografa item e descreve brevemente.
2. LLM analisa foto + contexto → sugere: descrição, norma, prioridade GUT, esforço.
3. Técnico confirma/edita.
4. Gerar backlog: itens `nao_conforme` → `backlog_items` com `origem = inspecao`.

### Visita
- Agendamento: cliente + data + turno (manhã/tarde/integral) + técnico + itens do backlog.
- Planejamento enviado automaticamente via WhatsApp (Zé ou endpoint direto).
- Técnico registra resultado por item: executado / adiado / parcial / cancelado.
- Relatório gerado e enviado ao finalizar.

### Relatório Diário
- Um por (técnico, cliente, data).
- Texto resumido gerado por LLM + resumo JSON.
- Enviado ao grupo WhatsApp do condomínio.

### Relatório Mensal
- PDF: OS do período + preventivas cumpridas + SLA + NPS + assinatura.
- Gerado por batch agendado (cron) em lotes de ≤10 por execução.
- Armazenado em bucket privado com signed URL.

## Integrações
- **Auvo**: bidirecional — ver `docs/blueprint/integracoes/auvo.md`.
- **WhatsApp/Evolution**: envio de relatórios e planejamentos de visita.
- **OpenRouter**: análise de fotos de inspeção (Claude) e geração de relatórios (Gemini).

## Métricas / SLA
| Métrica | Definição |
|---------|-----------|
| **SLA de atendimento** | Tempo abertura → despacho; despacho → execução; execução → fechamento |
| **% preventivo cumprido** | OS preventivas realizadas / planejadas no período |
| **Backlog em semanas** | Horas pendentes / horas contratuais por semana |
| **Taxa de não-conformidade** | Itens `nao_conforme` / total inspecionados |
