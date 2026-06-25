---
name: glossary
description: Linguagem ubíqua do Sinérgica OS. Puxe ao nomear, modelar domínio ou escrever specs.
alwaysApply: false
---

# Glossário — Linguagem Ubíqua do Sinérgica OS

> Fonte única do vocabulário do sistema. O mesmo termo aparece aqui, na spec e no código.
> Termo novo introduzido por uma feature → adicione no mesmo PR. Sem sinônimos.

| Termo | Definição | NÃO confundir com | Contexto (bounded context) |
|-------|-----------|-------------------|----------------------------|
| **Auvo** | App móvel de gestão de campo usado pelos técnicos (check-in GPS, fotos, checklist, assinatura offline). Não é substituível para execução. | PCM (o sistema de decisão) | Todos |
| **Auvo Task** | Tarefa no Auvo — a representação de campo de uma OS do PCM. Criada via API quando OS entra no status `planejamento`. | OS (a entidade de decisão no PCM) | PCM |
| **Backlog** | Lista de itens de manutenção pendentes de um condomínio, priorizados por score GUT. | Lista de chamados (OS abertas) | PCM |
| **Backlog Item** | Um único item de manutenção no backlog — origem pode ser inspeção, chamado manual, preventivo ou solicitação do cliente. | OS (ordem de serviço executável) | PCM |
| **Categoria (OS)** | Tipo de trabalho de uma OS: `corretiva`, `preventiva`, `inspecao`, `levantamento`, `emergencial`. | Prioridade (criticidade) | PCM |
| **Chamado** | Sinônimo de Ordem de Serviço no vocabulário do cliente/síndico. Evitar no código — usar `OS`. | Backlog item (pré-OS) | PCM, Atendimento |
| **Condomínio** | Cliente da Sinérgica — sempre uma pessoa jurídica (condomínio residencial ou comercial). | Cliente prospecto (lead) | PCM, Comercial |
| **Corretiva** | OS gerada para corrigir um problema identificado (backlog, chamado via Zé, inspeção). | Preventiva (rotina planejada) | PCM |
| **externalId** | ID da OS no PCM enviado ao Auvo para garantir idempotência (não duplica task se reenviar). | auvo_task_id (gerado pelo Auvo) | PCM |
| **GUT** | Matriz de priorização: Gravidade × Urgência × Tendência (cada fator 1–5), score de 1 a 125. | NPS (satisfação do cliente) | PCM |
| **Inspeção** | Vistoria técnica completa de um condomínio — gera itens com resultado OK/Não OK/Atenção e alimenta o backlog automaticamente. | Visita (atendimento de OS) | PCM |
| **Laudo SPDA** | Documento técnico de Sistema de Proteção contra Descargas Atmosféricas (NBR 5419:2026), gerado com auxílio de IA. | Relatório mensal (gestão) | PCM |
| **Levantamento** | Coleta de informações em campo para geração de uma proposta comercial. | Inspeção (vistoria técnica) | Comercial |
| **Ordem de Serviço (OS)** | Registro de um trabalho de manutenção — criado no PCM, executado pelo técnico via Auvo. Identificado por `CH-XXX` na UI. | Auvo Task (reflexo de campo) | PCM |
| **PCM** | Planejamento e Controle de Manutenção — módulo núcleo do Sinérgica OS, system of record da operação técnica. | Sinérgica OS (o sistema completo) | PCM |
| **Plano Preventivo** | Calendário de manutenções periódicas por equipamento/sistema com periodicidade definida. | Backlog (demanda corretiva) | PCM |
| **Preventiva** | OS gerada a partir do plano preventivo — rotina periódica (mensal, trimestral, etc.). | Corretiva (reativa) | PCM |
| **Prioridade** | Classificação de uma OS ou backlog item: `critica`, `alta`, `media`, `baixa` (derivada do score GUT). | Categoria (tipo de OS) | PCM |
| **Proposta** | Documento comercial gerado para um condomínio prospecto, com escopo, materiais, MO e valor — pontual ou contrato mensal. | Contrato (proposta aceita) | Comercial |
| **Relatório Diário** | Consolidação automática das OS executadas no dia por técnico/cliente, enviado ao síndico via WhatsApp. | Relatório mensal | PCM |
| **Relatório Mensal** | PDF consolidando o período (OS, preventivas, SLA, NPS) enviado ao síndico. Gerado por batch agendado. | Relatório diário | PCM |
| **Score PCM** | `gravidade × urgência × tendência` — inteiro de 1 a 125, coluna gerada pelo banco. | Prioridade (classificação qualitativa) | PCM |
| **Síndico** | Representante do condomínio cliente que usa o WhatsApp/portal para abrir chamados e receber relatórios. | Administradora (terceiro) | Atendimento, Área do Cliente |
| **Técnico** | Profissional da Sinérgica que executa OS em campo via app Auvo. | Escritório (operador do sistema) | PCM |
| **Visita** | Agendamento de um técnico em um condomínio em data/turno específico, com itens do backlog associados. | OS (trabalho individual executável) | PCM |
| **Volante** | Modelo de precificação de contrato mensal da Sinérgica — cálculo de custo (salário + encargos + benefícios + veículo + overhead) para definir preço. | Proposta pontual | Comercial |
| **Zé** | Agente de IA no WhatsApp que recebe chamados, coleta informações e abre OS no PCM automaticamente. Usa LLM Gemini 2.5 Flash via OpenRouter. | Técnico (humano de campo) | Atendimento |
