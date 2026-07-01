---
name: blueprint-pcm-operacao
description: Requirements do módulo PCM / Operação — núcleo do Sinérgica SO. Puxe ao planejar specs de OS, backlog, visitas ou inspeções.
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

### Calendário de Manutenção Preventiva

Duas visões do plano preventivo, solicitadas pela Sinérgica:

**Visão compacta (padrão):** lista tabular com equipamento, área, frequência, última execução, próxima data e status (em dia / pendente).

**Visão calendário (expandida):** grid mensal/anual — colunas = dias do mês, linhas = frequência por equipamento, células coloridas com código de atividade:
- Ciano: programada sem pendência
- Âmbar: programada com pendência
- Cinza: executada/baixada

Hierarquia de navegação: `Cliente → Torre/Bloco → Área → Equipamento → Frequência`

Filtros: cliente (um ou todos), período (mês / visão anual 12 meses), agrupamento por localização.

Exportação: PDF com cabeçalho (empresa, cliente, período, logo do condomínio) + legenda de cores.

Fonte de dados: `pcm.plano_preventivo` (regras de recorrência) × `pcm.ordens_servico` (execuções) — o calendário é gerado pelo PCM, não depende do Auvo para a renderização. A célula muda para "executada" quando a OS preventiva é fechada (via Auvo webhook).

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

---

## Sub-módulo PMOC (Plano de Manutenção, Operação e Controle)

> Stories: E01-S03 a E01-S06 · Schema Postgres: `pcm` (prefixo `pmoc_*`)

### O que é e por que existe

PMOC é um **documento legal obrigatório** (Portaria MS nº 3.523/1998 + ABNT NBR 13.971/2014 + ANVISA RDC 09/2003) para toda edificação de uso coletivo com sistema de ar condicionado. Define quais equipamentos existem, quais manutenções devem ser feitas, com que frequência, quem é o responsável técnico (Fabrício Medeiros, CREA) e registra todas as visitas executadas.

A Sinérgica executa o PMOC para seus clientes de contrato Completo e Premium. O sistema automatiza o cronograma anual, gera os laudos de visita em PDF e emite alertas de vencimento de ART e análise microbiológica.

**Consequência de não ter PMOC válido:** multa da ANVISA/Vigilância Sanitária, responsabilidade civil do proprietário e invalidação de seguro do imóvel.

### Base legal

| Norma | Obrigação |
|-------|-----------|
| Portaria MS 3.523/1998 | Obrigatoriedade do PMOC para edificações coletivas com AC |
| ABNT NBR 13.971/2014 | Especificações técnicas dos procedimentos de manutenção |
| ANVISA RDC 09/2003 | Qualidade do ar interior — obriga análise microbiológica semestral |

### Entidades do PMOC

| Entidade | Tabela | Descrição |
|----------|--------|-----------|
| **Imóvel PMOC** | `pcm.pmoc_properties` | Local físico com AC. Vinculado ao cliente PCM. Dados: nome, tipo, endereço, CNPJ, contato do responsável, e-mail para laudos. |
| **Equipamento de Climatização** | `pcm.pmoc_equipment` | Um registro por sistema (evaporadora + condensadora = 1 equipamento). Tag único por imóvel (AC-01, AC-02…). Dados: tipo, marca, modelo, nº de série, BTU/h, refrigerante, fase, localização, condição. |
| **Contrato PMOC** | `pcm.pmoc_contracts` | Vínculo imóvel + Sinérgica com vigência anual. Campos obrigatórios: ART, CREA, start/end date. Ao criar, gera automaticamente o cronograma anual. |
| **Cronograma de Visitas** | `pcm.pmoc_schedules` | Uma linha por visita planejada (12 por ano). Tipo: `mensal` / `trimestral` / `semestral` / `anual`. Gerado automaticamente pela Edge Function ao criar o contrato. |
| **Registro de Visita / Laudo** | `pcm.pmoc_records` | Criado via webhook do Auvo quando a OS é fechada. Contém: checklist executado (JSONB), equipamentos atendidos, NCs, materiais, assinaturas. Gera PDF e envia por e-mail ao responsável do imóvel. |
| **Análise Microbiológica** | `pcm.pmoc_microbio_analysis` | Laudo de laboratório acreditado (INMETRO). Obrigatório a cada 6 meses. Limites legais: fungos ≤ 750 UFC/m³, relação I/E ≤ 1,5, coliformes = ausência. |
| **Log de NC** | `pcm.pmoc_nonconformity_log` | Registro persistente de não-conformidades com severidade (alta/média/baixa), responsável e prazo. NC alta dispara alerta imediato ao engenheiro. |

### Periodicidades acumulativas

As manutenções são acumulativas: uma visita trimestral executa tudo do mensal + os extras trimestrais.

| Tipo | Meses (contrato 12m) | Inclui |
|------|---------------------|--------|
| Mensal | 1, 2, 4, 5, 7, 8, 10, 11 | Checklists mensais (evaporadora + condensadora) |
| Trimestral | 3, 9 | Mensal + limpeza serpentina + medições elétricas |
| Semestral | 6 | Trimestral + limpeza química + medição refrigerante + **análise microbiológica obrigatória** |
| Anual | 12 | Semestral + revisão geral + renovação ART + novo PMOC |

### Checklists canônicos

Os checklists são definidos como **constante TypeScript em `packages/shared`** (não no banco — é dado estático). Cada item tem um ID estável (ex: `m_e_01`, `t_c_03`, `s_m_01`) usado no JSONB de `pmoc_records.checklist` e nos payloads enviados ao Auvo.

Grupos: `evaporadora`, `condensadora`, `sistema` (trimestral), `limpeza_profunda`, `eletrico`, `refrigeracao`, `microbiologico` (semestral), `revisao_geral`, `documentacao` (anual).

### ART — Anotação de Responsabilidade Técnica

Vincula Fabrício Medeiros (CREA) ao serviço executado. Campos em `pmoc_contracts`: `crea`, `art_number`, `art_date`. Alerta automático D-30 antes do `end_date`: `status → 'renovar'` + notificação no dashboard.

### Integração PMOC ↔ inventário geral (`pcm_equipment`)

Ao cadastrar um equipamento de AR no PMOC, o sistema cria automaticamente um registro em `pcm.pcm_equipment` com `discipline = 'climatizacao'` e `pmoc_equipment_id` preenchido. Isso garante que o AR apareça no plano de manutenção geral do imóvel sem duplicação de dados.

### Automações (Edge Functions / cron)

| Job | Frequência | O que faz |
|-----|-----------|-----------|
| `pmoc-daily-status` | Diário 00:01 | Atualiza `pmoc_schedules.status → 'atrasado'` quando data vencida |
| `pmoc-create-auvo-os` | Diário 08:00 | Cria OS no Auvo para visitas com `scheduled_date = hoje + 7d` e sem `auvo_os_id` |
| `pmoc-alert-art` | Diário 08:00 | Alerta D-30 de vencimento de ART (`pmoc_contracts.end_date - 30 <= hoje`) |
| `pmoc-alert-microbio` | Diário 08:00 | Alerta quando análise microbiológica vence em ≤ 30 dias |

---

## Hub de OS — Fila Unificada de Ordens de Serviço

> Story: E01-S07 (tier arquitetural) · Tabela: `pcm.os_hub`

### Tipos de OS

| Código | Nome | Origem | SLA | Prioridade base |
|--------|------|--------|-----|-----------------|
| **C1** | Emergencial | Chamado urgente (Zé / escritório) | 4h | 1 |
| **C2** | Corretiva programada | Chamado normal | 72h | 2 |
| **P1** | Preventiva PMOC | Gerada pelo módulo PMOC (automático D-7) | Janela ±3 dias | 3 (2 se atrasada) |
| **P2** | Preventiva predial | Gerada pelo PCM geral | Janela ±7 dias | 3 |
| **IN** | Inspeção / follow-up | Detectada em visita anterior | Prazo acordado | 4 |

> **Regra de escalonamento:** P1 atrasada (data vencida) sobe para prioridade 2 — equivalente a corretiva programada. O atraso num PMOC é risco legal.

### Cálculo de prioridade

```
C1 → 1 (deslocar agora)
C2 → 2 (corretiva programada)
P1 com scheduled_date < hoje → 2 (PMOC atrasado = risco legal)
P1 com scheduled_date >= hoje → 3 (preventiva no prazo)
P2 → 3 (preventiva predial)
IN → 4 (follow-up)
```

### Dias preventivos

Cada técnico pode ter N dias/semana marcados como "preventivos" — esses dias só recebem P1 e P2. OS C2 e IN não são alocadas nesses dias. C1 pode entrar em qualquer dia (é emergencial).

### Observação arquitetural (decisão para E01-S07)

O `os_hub` pode ser implementado como: (a) **nova tabela** que projeta/unifica as OS do PCM com os schedules do PMOC, ou (b) **refatoração da tabela de OS existente** para absorver os tipos C1/C2/P1/P2/IN. Esta decisão será tomada no `design.md` de E01-S07 antes de implementar.
