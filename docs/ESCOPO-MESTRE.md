---
name: ESCOPO-MESTRE
description: Documento mestre de escopo do Sinérgica OS (produto) — dores do setor, 11 módulos, features com motivador, roadmap e checklist de aprovação. Puxe ao planejar qualquer módulo ou alinhar escopo com o cliente.
alwaysApply: false
---

# Sinérgica OS — Documento Mestre de Escopo

> **Projeto:** Sinérgica OS · **Cliente:** Sinérgica Manutenções Patrimoniais · **Autor:** Trívia Studio
> **Versão:** 1.1 · **Status:** escopo de referência (vivo) · **Para avaliação de:** Fabrício Medeiros

> **Propósito.** Escopar, de ponta a ponta, o sistema operacional da Sinérgica: as dores do mercado de
> manutenção predial e climatização, a visão de produto, os módulos, suas regras de negócio, a
> integração com o Auvo e o roadmap. É o documento de referência de produto — abaixo dele vivem os
> blueprints técnicos por módulo (`docs/blueprint/`) e as specs SDD (`specs/`).
>
> 📋 **Para aprovar o escopo:** vá à **§13 — Checklist de Aprovação**. Marque cada feature como OK ou
> registre uma consideração. Use o corpo do documento (§1–§12) como contexto de cada item. As
> **decisões de produto (§11)** também precisam do seu direcionamento — cada uma já vem com a nossa
> recomendação.

---

## ⚡ Resumo Executivo (1 página)

**O quê.** O **Sinérgica OS** é o sistema operacional único da Sinérgica Manutenções — onde a
liderança e o escritório operam a empresa inteira a partir de um só lugar. Ele **comanda o Auvo** (que
segue na mão do técnico, no campo) e constrói ao redor tudo que falta hoje: visão por cliente, controle
de backlog, preventivo conforme a lei, ciclo financeiro, comercial, atendimento com IA e portal do cliente.

**O problema que resolve.** Hoje a operação é coordenada por WhatsApp + planilhas + Auvo + memória das
pessoas. Falta um cérebro central. O sintoma mais caro: **não existe visão centralizada por cliente** —
para falar de um condomínio, o gestor abre quatro lugares.

**A aposta.** O ativo mais valioso de uma empresa de manutenção é a **memória da operação** (quem fez o
quê, em qual equipamento, quando, por quê, quanto custou). Hoje está fragmentada. O OS a unifica numa
base única — e dela passam a fluir decisões, faturamento, prestação de contas e inteligência.

**Os 11 módulos:**

| # | Módulo | O que entrega de poder |
|---|--------|------------------------|
| 1 | **PCM / Operação** ⭐ | A espinha dorsal: Visão 360 do cliente, backlog priorizado, OS que viram tarefa no Auvo sozinhas, preventivo/PMOC que não esquece, relatórios prontos para o cliente |
| 2 | **Atendimento (IA)** | Agentes que abrem chamado (Zé) e qualificam/conduzem vendas — atendimento 24/7 sem depender de gente livre |
| 3 | **Comercial (CRM)** | Funil + proposta com preço padronizado + contrato, em fluxo único |
| 4 | **Operação & Estoque** | Peças por OS **+ controle de ferramentas e kits** (custódia, quem pegou, calibração) |
| 5 | **Financeiro** | Caixa, faturamento e **rentabilidade por contrato** — saber se cada cliente dá lucro |
| 6 | **Marketing** | Conteúdo para **Instagram e LinkedIn** via **Jimmy Studio** (texto → imagem → publicação) |
| 7 | **Growth** | Leitura de Meta/Google Ads — onde colocar a verba |
| 8 | **Gestão (Cockpit)** | Painel executivo: operação, margem, atrasos, funil, caixa |
| 9 | **Área do Cliente** | Portal do síndico: OS, histórico, documentos e situação financeira |
| 10 | **Dados (Base Única)** | A fundação — fonte única que alimenta os agentes de IA |
| 11 | **Inteligência & Roteirização** | A base vira decisão: **roteirização (Google Maps)**, manutenção preditiva, antecipação de churn |

**Por onde começa.** Pelo **PCM** — a espinha dorsal. Sem ele bom, o resto não tem do que se alimentar.

**Roadmap em 4 fases:** (1) loop operacional mínimo — PCM + Auvo + Zé; (2) fechar operacional + comercial;
(3) ciclo financeiro; (4) crescimento (marketing, growth, portal) + go-live. Detalhe em §10.

**Diferencial competitivo.** Tratar **conformidade legal** (PMOC, SPDA, calibração) como obrigação com
prazo que o sistema cuida — raro nos concorrentes — e uma camada de **inteligência** (roteirização,
preditiva) que a maioria não tem.

**O que precisa do Fabrício para começar:** 15 decisões de produto em §11 — cada uma já vem com a nossa
recomendação para acelerar o "OK".

---

## 📑 Sumário

1. [Sumário Executivo](#1-sumário-executivo)
2. [As Dores do Mercado (e o que o OS resolve)](#2-as-dores-do-mercado-e-o-que-o-os-resolve)
   — Liderança · Operação · Técnico · Cliente · Comercial
3. [Visão de Produto](#3-visão-de-produto)
4. [Arquitetura de Alto Nível](#4-arquitetura-de-alto-nível)
5. [Mapa de Módulos](#5-mapa-de-módulos)
6. [Detalhamento por Módulo](#6-detalhamento-por-módulo)
   - 6.1 [PCM / Operação ⭐](#61-pcm--operação--a-espinha-dorsal) *(começa por aqui)*
   - 6.2 [Atendimento (Agentes de IA)](#62-atendimento--agentes-de-ia)
   - 6.3 [Comercial (CRM)](#63-comercial-crm)
   - 6.4 [Operação & Estoque (Peças + Ferramentas)](#64-operação--estoque-almoxarifado-peças--ferramentas)
   - 6.5 [Financeiro](#65-financeiro)
   - 6.6 [Marketing](#66-marketing-conteúdo-multicanal)
   - 6.7 [Growth](#67-growth-análise-de-anúncios)
   - 6.8 [Gestão (Cockpit)](#68-gestão-cockpit--painel-de-indicadores)
   - 6.9 [Área do Cliente](#69-área-do-cliente-portal-do-síndico)
   - 6.10 [Dados (Base Única)](#610-dados-base-única)
   - 6.11 [Inteligência & Roteirização](#611-inteligência-da-operação--roteirização--a-base-única-virando-decisão)
   - 6.12 [Capacidades Transversais](#612-capacidades-transversais)
7. [Integração com o Auvo](#7-integração-com-o-auvo-a-fronteira)
8. [Papéis e Permissões](#8-papéis-e-permissões)
9. [Conformidade Legal & Laudos](#9-conformidade-legal--laudos-diferencial-de-domínio)
10. [Roadmap de Construção](#10-roadmap-de-construção-fases)
11. [Decisões em Aberto — Roteiro de Entrevista](#11-decisões-em-aberto--roteiro-de-entrevista-com-o-fabrício)
12. [Glossário](#12-glossário-rápido)
13. [✅ Checklist de Aprovação do Escopo](#13--checklist-de-aprovação-do-escopo) *(para o Fabrício)*

---

## 1. Sumário Executivo

A Sinérgica é uma empresa de **manutenção predial e de climatização (HVAC)** que atende
condomínios e empresas em Campinas/SP. Como toda empresa do setor que cresce, ela bateu no teto
de uma operação coordenada por WhatsApp, planilhas e um app de campo (Auvo) sem um cérebro central
que conecte comercial, operação, campo, financeiro e cliente.

O **Sinérgica OS** é esse cérebro: um sistema operacional único onde a liderança **opera a empresa
inteira a partir de um só lugar**. Ele não substitui o Auvo — o técnico continua no Auvo, no campo.
Ele **comanda** o Auvo e é realimentado por ele, e ao redor disso constrói tudo que falta: visão
360 por cliente, controle de backlog e SLA, plano preventivo legalmente conforme (PMOC, SPDA),
ciclo financeiro fechado, CRM comercial, agentes de IA no atendimento e portal do cliente.

**A tese central:** numa empresa de manutenção, o ativo mais valioso não é o técnico nem a
ferramenta — é a **memória da operação**. Quem fez o quê, em qual equipamento, quando, por quê, e
quanto custou. Hoje essa memória está fragmentada (cada coisa num lugar). O OS a unifica numa base
única, e é dela que tudo passa a fluir: decisões, faturamento, prestação de contas e inteligência.

---

## 2. As Dores do Mercado (e o que o OS resolve)

Esta seção é o coração do diagnóstico. Foram organizadas por quem sente a dor.

### 2.1. Dores da Liderança / Gestão

| # | Dor | Hoje | Como o OS resolve |
|---|-----|------|-------------------|
| L1 | **"Não tenho visão por cliente."** | Para saber tudo de um condomínio, é preciso cruzar WhatsApp + Auvo + planilha + memória do gestor | **Visão 360 do Cliente** — uma tela com contrato, equipamentos, backlog, histórico de OS, preventivo, relatórios, financeiro e comunicação |
| L2 | **"Não sei se o contrato dá lucro."** | Receita é conhecida; custo real (mão de obra + peças + deslocamento) não | Módulo Financeiro consolida custo real por OS → **rentabilidade por contrato** com alerta de margem negativa |
| L3 | **"Não sei o que está pendente."** | Backlog mora na cabeça das pessoas e em mensagens soltas | **Backlog priorizado (GUT)** por cliente, com indicador de saúde (horas pendentes ÷ horas contratuais) |
| L4 | **"Cumprimos o preventivo?"** | Sem rastreio de % de preventivo realizado vs planejado | **Calendário de manutenção** + indicador de aderência ao plano (crítico para PMOC/conformidade) |
| L5 | **"Onde está minha equipe?"** | Telefonema para o técnico | GPS dos técnicos (via Auvo) no painel do OS, em horário operacional |
| L6 | **"Quanto vou faturar e receber este mês?"** | Estimativa de cabeça | Fluxo de caixa + contas a receber + faturamento automático a partir das OS e contratos |
| L7 | **"Por que perdi aquele cliente?"** | Sem histórico de relacionamento nem sinais de churn | CRM + indicadores de satisfação (NPS) + histórico completo no Cockpit |
| L8 | **"Estou em conformidade legal?"** | Controle manual de laudos, ARTs, vencimentos | Gestão de **conformidade** — PMOC, SPDA, análise de água, AVCB, com alertas de vencimento (ver §9) |
| L9 | **"Entreguei o que vendi?"** | Não se sabe se o escopo do contrato (visitas/mês, sistemas) foi cumprido até a renovação ou a reclamação | **Contrato previsto × realizado** — placar de cumprimento por cliente (§6.1) |
| L10 | **"Refizemos de graça?"** | Serviço refeito sem saber se é garantia; custo engolido em silêncio | **Controle de garantia** por equipamento — sinaliza retrabalho dentro do prazo (§6.1) |

### 2.2. Dores da Operação / Escritório (PCM)

| # | Dor | Como o OS resolve |
|---|-----|-------------------|
| O1 | Chamado chega por WhatsApp e some no histórico do grupo | **Agente Zé** transforma a conversa em OS formal, rastreável, com confirmação |
| O2 | Abrir OS, lançar no Auvo e avisar o técnico é trabalho triplo e manual | OS aberta no PCM **vira tarefa no Auvo automaticamente** (`externalId` idempotente) |
| O3 | Inspeção em campo vira um caderno de fotos sem destino | **Inspeção com IA**: foto + descrição → sugestão de não-conformidade, norma, prioridade → vira backlog |
| O4 | Planejar a semana dos técnicos é Tetris no quadro branco | **Cronograma e Visitas** — agendamento por cliente/turno/técnico com os itens de backlog a executar |
| O5 | Relatório para o síndico é montado à mão toda vez | Relatório **diário e mensal gerados automaticamente** (texto por IA + PDF) e enviados |
| O6 | Cadastro de equipamento sem padrão, sem histórico | **Árvore de ativos** (Cliente → Torre → Área → Equipamento) com histórico por equipamento |
| O7 | **"Não sei com quem está cada ferramenta."** Ferramenta cara (manifold, recolhedora, megômetro) some sem dono; ninguém sabe quem pegou | **Controle de Ferramentas & Kits** — custódia em tempo real, empréstimo/devolução, histórico de posse, classificação comum/específico (ver §6.4) |
| O8 | **Técnico parado esperando aprovação.** Custo extra fora do contrato trava a execução até alguém falar com o síndico | **Aprovação de orçamento** pelo cliente no celular — destrava a OS na hora (§6.1) |
| O9 | **Cliente novo demora a entrar.** Cadastrar condomínio, ativos, plano e acessos é manual e inconsistente | **Onboarding de contrato** guiado — cliente operacional em horas, com padrão (§6.1) |

### 2.3. Dores do Técnico de Campo

| # | Dor | Como o OS resolve |
|---|-----|-------------------|
| T1 | Recebe ordem vaga, sem contexto do que já foi feito | OS chega no Auvo com orientação clara + histórico do equipamento puxado do PCM |
| T2 | Dúvida técnica em campo sem quem perguntar | **Agente de IA de apoio ao técnico** (procedimentos, normas, diagnóstico assistido) — *escopo a definir, ver §6.2* |
| T3 | Retrabalho por falta de peça | Estoque e separação de peças por OS antecipam a necessidade |

> **Premissa intocável:** o trabalho de campo (check-in/out, foto, assinatura, checklist) **permanece
> no app Auvo**. O OS não tenta reconstruir o app móvel — ele alimenta o técnico de contexto e
> recebe de volta o que aconteceu.

### 2.4. Dores do Cliente Final (Síndico / Gestor Predial)

| # | Dor | Como o OS resolve |
|---|-----|-------------------|
| C1 | Não sabe o status do chamado que abriu | **Portal do Cliente** + respostas do Zé com nº do chamado |
| C2 | Cobra "prova" do serviço para a assembleia | Relatórios mensais, fotos de antes/depois, laudos — disponíveis no portal |
| C3 | Não tem onde ver o que já foi feito no prédio | Histórico completo de OS e preventivo no portal |
| C4 | Atrito sobre o que está em dia financeiramente | Situação financeira (faturas, vencimentos) no portal |

### 2.5. Dores Comerciais e de Crescimento

| # | Dor | Como o OS resolve |
|---|-----|-------------------|
| G1 | Proposta demora e sai sem padrão de preço | **Motor de precificação** (volante/residente) + geração assistida por IA a partir do levantamento |
| G2 | Lead esfria porque ninguém respondeu a tempo | **Agentes de IA comerciais** (SDR/closer) qualificam e conduzem |
| G3 | Marketing reativo e sem constância | Módulo Marketing produz conteúdo multicanal de ponta a ponta |
| G4 | Verba de anúncio gasta no escuro | Módulo Growth lê Meta/Google Ads e orienta o investimento |
| G5 | Não sabe de onde vêm os bons clientes | Atribuição de leads (canal → proposta → contrato) |

---

## 3. Visão de Produto

### 3.1. O que o OS é

> Um **sistema nervoso central** da empresa de manutenção. A liderança e o escritório operam **tudo**
> a partir dele. O Auvo é o **braço de campo**. Os clientes têm uma **janela** (portal). Os agentes de
> IA são **funcionários digitais** que atuam no atendimento, no comercial e no apoio técnico.

### 3.2. O que o OS **não** é
- Não é um app de campo (isso é o Auvo).
- Não é um ERP fiscal completo (emissão de NF-e pode ser integração, não reconstrução).
- Não é um sistema genérico — é moldado às dores de manutenção predial e climatização.

### 3.3. Princípios de produto
1. **Uma porta, uma verdade.** Todo dado de gestão nasce e vive no OS. Todo dado de campo nasce no Auvo. Sem duplicidade, sem "qual está certo?".
2. **Visão centrada no cliente.** A unidade mental do sistema é o **condomínio/contrato**, não a OS isolada.
3. **Conformidade como cidadã de primeira classe.** PMOC, SPDA e laudos não são "relatórios" — são obrigações com prazo, e o sistema cuida do prazo.
4. **IA onde tira trabalho repetitivo.** Atendimento, triagem, geração de texto, análise de foto, sugestão de preço — sempre com humano no controle da decisão.
5. **Prestação de contas automática.** O cliente recebe prova do serviço sem o escritório montar nada à mão.

---

## 4. Arquitetura de Alto Nível

```
┌────────────────────────────────────────────────────────────────┐
│                         SINÉRGICA OS                            │
│  (React SPA · Supabase · onde a liderança e o escritório operam)│
│                                                                │
│  Comercial · Atendimento(IA) · PCM/Operação · Estoque ·        │
│  Financeiro · Marketing · Growth · Gestão(Cockpit) · Dados     │
└───────────────┬───────────────────────────────┬───────────────┘
                │ escreve (cria OS, cliente,    │ janela (read-only
                │ equipamento, preventivo)      │ + abrir chamado)
                ▼                               ▼
        ┌──────────────┐               ┌─────────────────┐
        │     AUVO     │               │ ÁREA DO CLIENTE │
        │ (app campo)  │               │   (síndico)     │
        └──────┬───────┘               └─────────────────┘
               │ devolve (status, foto, checklist,
               │ peça, GPS, assinatura) via webhook + polling
               ▼
        ┌──────────────┐
        │ SINÉRGICA OS │  ← realimentado
        └──────────────┘

Canais de IA:  WhatsApp (Evolution API) ── Agentes ── OpenRouter (Gemini/Claude)
Inteligência:  Google Maps Platform (geocoding + roteirização) ── camada de inteligência (§6.11)
```

**Regra de ouro PCM × Auvo:** PCM é origin of truth das **decisões** (abrir, priorizar, atribuir,
planejar); Auvo é origin of truth da **execução** (GPS, foto, checklist, assinatura). Detalhe técnico
em *Mapeamento Auvo x PCM como Hub (29-06-2026)*.

---

## 5. Mapa de Módulos

| # | Módulo | Papel no negócio | Maturidade hoje |
|---|--------|------------------|-----------------|
| 1 | **PCM / Operação** | Espinha dorsal — o ciclo de vida da manutenção | Evolução de software existente |
| 2 | **Atendimento (Agentes de IA)** | Porta de entrada e relacionamento automatizado | Parcial (Zé existe) |
| 3 | **Comercial (CRM)** | Funil: prospect → proposta → contrato | Parcial (propostas existem) |
| 4 | **Operação & Estoque** | Peças, custo de material, suprimento + **ferramentas e kits** | Novo |
| 5 | **Financeiro** | Caixa, faturamento, rentabilidade | Novo |
| 6 | **Marketing** | Geração de demanda (conteúdo) | Novo |
| 7 | **Growth** | Inteligência de anúncios | Novo |
| 8 | **Gestão (Cockpit)** | Visão executiva e indicadores | Novo |
| 9 | **Área do Cliente** | Transparência e prestação de contas | Novo |
| 10 | **Dados (Base Única)** | Fundação — fonte única que alimenta a IA | Arquitetural |
| 11 | **Inteligência & Roteirização** | Camada que transforma a base em decisão (roteirização Google Maps, preditiva) | Novo |

---

## 6. Detalhamento por Módulo

> Cada módulo abaixo descreve: **dor que resolve · funcionalidades · entidades · regras de negócio ·
> integrações · indicadores**. O detalhe técnico (schema, RLS, edge functions) vive nos blueprints.

### 6.1. PCM / Operação — *a espinha dorsal*

**Por que é o coração.** É a evolução do PCM atual da Sinérgica — que funciona, mas é "pobre": não
tem visão centralizada por cliente e não fecha as dores de operação. Tudo no OS gravita em torno do
PCM: é onde a manutenção **nasce** (chamado/inspeção/plano), é **planejada**, é **executada** (via
Auvo) e tem suas **contas prestadas**. Se o PCM for bom, todo o resto do OS tem do que se alimentar.

> **Princípio do módulo: nada de tela bonita sem função.** Cada recurso abaixo existe porque (a) tira
> um trabalho manual, (b) evita um esquecimento caro, ou (c) dá um poder de decisão que hoje não
> existe. As features-marco vêm com **Hoje → Com o OS → Poder → Valor** para deixar explícito o que
> muda na operação.

#### 🔒 Paridade com o PCM v2 — base obrigatória (não regredir) + o que o OS acrescenta
> Auditamos o **código inteiro** do PCM v2 (12 módulos, 28 tabelas, 24 edge functions). O OS deve
> entregar **100% do que o PCM faz hoje** como linha de base — e ir além. Abaixo, features reais do v2
> que estavam implícitas no escopo e agora ficam **explícitas**, para não perdermos nada na migração.

Features do v2 a **preservar e melhorar**:
- **Catálogo real de tipos de serviço** (hoje mapeado a IDs do Auvo): Corretiva, Ar-Condicionado, Bomba,
  Quadro Elétrico, Luminária, Porta/Portão, Extintor, Hidrante, **Rondas** (semanal/diária por cliente),
  Levantamento e Atendimento Emergencial. *(O OS mantém esse catálogo — não uma lista genérica.)*
- **Decisão de material no levantamento:** ao levantar um serviço, registrar quem fornece o material —
  *cliente compra* / *Sinérgica fornece com markup* / *vira proposta de execução* — com o markup aplicado.
- **Vínculo de OS (pai-filho):** uma corretiva pode gerar/atrelar OS filhas, mantendo a árvore do chamado.
- **Estimativa de esforço por IA:** o backlog já calcula horas estimadas com justificativa — o OS mantém
  e passa a **aprender com o realizado** (esforço estimado × real).
- **Citação normativa por IA:** cada item de backlog/inspeção cita a norma (NBR etc.) — base de qualidade.
- **Inspeção por sistema predial** (12 sistemas: estrutural, hidrossanitário, elétrico, SPDA, cobertura,
  fachada, áreas comuns, equipamentos, incêndio, ar-condicionado, elevadores, geral), com análise de foto
  por IA (descrição, norma, GUT, esforço, título de backlog pronto).
- **Importação de inspeção/laudo legado** (PDF e XLS): extrai itens via IA e estrutura no backlog —
  acelera a migração do histórico de papel/planilha.
- **Rondas recorrentes** (diária/semanal) além do preventivo mensal→anual — o calendário mostra ambos.
- **Resultado por item de visita** (executado/adiado/parcial/cancelado) + flags de "planejamento enviado"
  e "relatório enviado".
- **Contrato com visitas/semana, visitas/mês e horas/visita** — alimenta a saúde do backlog e o
  previsto×realizado.
- **Relatório diário automático** ao fechar a visita no Auvo (ou manual, com **preview** antes de enviar).
- **Questionário do Auvo → backlog:** respostas de checklist no fim da visita geram itens de backlog.
- **Laudo SPDA completo** (edifício/dimensões, pontos de medição de resistência, nível de proteção I–IV,
  agentes de IA: analisador de foto, consultor NBR, diagnóstico, redator).
- **Leads/prospects** que hoje convivem no cadastro de clientes do PCM → migram para o **Comercial**,
  mantendo **uma identidade única** de cliente (centralidade).

O que o OS **acrescenta** sobre essa base: gestão de ativos de verdade (abaixo), Visão 360, conformidade
legal (§9), inteligência e roteirização (§6.11), garantia, contrato previsto×realizado, central de alertas
e relatórios sob demanda — sempre com a régua de **mais inteligência, mais qualidade, mais centralidade**.

#### ⭐ Visão 360 do Cliente — *a tela que muda tudo*
Uma página por condomínio reunindo contrato, árvore de equipamentos, backlog, histórico de OS,
calendário preventivo, relatórios, situação financeira e linha do tempo de comunicação.
- **Hoje:** para falar de um condomínio, o gestor abre WhatsApp + Auvo + planilha + memória. O síndico
  liga e ele responde *"deixa eu verificar e te retorno."*
- **Com o OS:** abre **uma** tela e vê tudo — o que está pendente, o que foi feito, o que está vencendo.
- **Poder:** atender com autoridade e decidir com o quadro completo na frente.
- **Valor:** resposta na hora, menos erro, imagem de empresa que tem controle. *Responde à dor L1.*

#### Cadastro de Clientes + Estrutura Administradora → Condomínio
Dados de gestão, contatos, grupo de WhatsApp, contrato. Modelo preparado para **uma administradora com
vários condomínios** (`Administradora → Condomínio → Torre/Bloco`).
- **Por que importa:** administradoras são o comprador B2B que mais escala no setor — fechar uma traz
  N prédios. O sistema precisa enxergar o portfólio inteiro de uma administradora **e** cada prédio
  individualmente. *Sem isso, o crescimento via administradora vira gambiarra de planilha.*

#### ⭐ Gestão de Ativos / Equipamentos do Cliente — *o maior salto sobre o PCM atual*
> **Pedido explícito do Fabrício.** Hoje o PCM só **espelha** o equipamento do Auvo (uma lista plana
> com nome + categoria, usada só para anexar um plano preventivo). Não há ficha, hierarquia, histórico
> nem ciclo de vida. O OS transforma isso em **gestão de ativos de verdade** — e o PCM passa a ser o
> **dono** do ativo (cadastra no OS, empurra para o Auvo via `externalId`; o Auvo vira espelho de campo).

A gestão de ativos cobre:
- **Ficha técnica completa** por equipamento: tipo, marca, modelo, nº de série, **capacidade**
  (ex.: BTU/TR para climatização), fabricante, data de instalação, fotos, **QR code**, manuais e
  documentos anexos.
- **Hierarquia de localização:** `Cliente → Torre/Bloco → Área → Sistema → Equipamento` (hoje é lista
  plana). Permite "todos os ativos da Torre A" ou "o histórico daquela bomba específica".
- **Histórico unificado por ativo:** toda OS (corretiva/preventiva), inspeção, peça trocada,
  medição/leitura e laudo daquele equipamento numa **linha do tempo única**. *(Hoje: não existe.)*
- **Plano preventivo / PMOC por ativo:** cada equipamento carrega sua periodicidade e obrigações.
- **Ciclo de vida / status:** operando · em manutenção · parado · substituído · baixado.
- **Garantia (fabricante + serviço):** alerta quando uma corretiva é refeita no mesmo equipamento
  dentro do prazo — separa retrabalho (custo a engolir) de serviço novo (a faturar).

- **Hoje:** o equipamento é uma linha cacheada do Auvo, sem prontuário; "qual a vida desse chiller?"
  não tem resposta.
- **Com o OS:** cada ativo tem um **prontuário completo** com tudo que já aconteceu nele.
- **Poder:** decidir **trocar vs. consertar** com dados, provar conformidade por equipamento, planejar
  o preventivo certo.
- **Valor:** é o **alicerce** do preventivo/PMOC, da garantia, dos laudos e da manutenção preditiva
  (§6.11). Sem gestão de ativos robusta, o "controle por cliente" fica oco.

#### Backlog & Priorização GUT
Score Gravidade × Urgência × Tendência (1–5 cada, máx 125); faixas (crítica ≥100, alta ≥50, média ≥20,
baixa <20); indicador de saúde do contrato (horas pendentes ÷ horas/semana → verde/amarelo/vermelho);
sugestão de repriorização por IA.
- **Hoje:** "o que faço primeiro" é decidido por quem grita mais alto no WhatsApp.
- **Com o OS:** uma fila objetiva, defensável, por cliente.
- **Poder:** justificar ao síndico **por que** um item espera e outro não — com critério, não achismo.
- **Valor:** a equipe trabalha no que de fato importa; some a urgência-fabricada.

#### Ordens de Serviço (Kanban) + sincronismo com o Auvo
`solicitação → planejamento → em execução → finalizado → faturado/cancelado`. Ao entrar em
planejamento, **gera a tarefa no Auvo automaticamente** (idempotente por `externalId = os.id`).
Categorias e **tipos de serviço seguem o catálogo real** do v2 (ver paridade acima): corretiva, preventiva (AC, bomba, quadro, extintor, hidrante…), ronda/inspeção, levantamento, emergencial.
- **Hoje:** abrir a OS, lançar no Auvo e avisar o técnico = **três** trabalhos manuais, com erro de
  transcrição.
- **Com o OS:** um clique — vira tarefa no Auvo, o técnico recebe **com o contexto e o histórico** do
  equipamento junto.
- **Poder:** o escritório deixa de ser digitador de Auvo.
- **Valor:** mais velocidade, menos erro, técnico melhor informado em campo.

#### Aprovação de Orçamento Extra pelo Cliente
Quando uma corretiva exige peça/custo fora do contrato, gera um **orçamento que o síndico aprova**
(link/WhatsApp/portal) antes da execução.
- **Hoje:** técnico **parado em campo** esperando alguém ligar para o síndico e confirmar; ou faz e
  cobra depois, gerando atrito.
- **Com o OS:** o orçamento sai na hora, o síndico aprova pelo celular, a OS destrava.
- **Poder:** decisão do cliente registrada (fim do "eu não autorizei isso").
- **Valor:** menos tempo ocioso de técnico, zero cobrança contestada, caixa mais previsível.

#### Inspeções com IA → Backlog automático
Técnico fotografa e descreve; o LLM sugere não-conformidade, norma (ex. NBR 5674), prioridade GUT e
esforço; o técnico confirma; itens não-conformes viram backlog.
- **Poder:** uma vistoria vira **lista de serviço priorizada e orçável**, não um caderno de fotos
  perdido. *Valor: a inspeção deixa de ser custo e vira gerador de demanda qualificada.*

#### Plano Preventivo & PMOC — *conformidade que não esquece*
Equipamento + periodicidade + mês/dia de início → gera OS recorrentes. Trata **PMOC como preventivo
legalmente obrigatório** (Lei 13.589/2018, ver §9).
- **Hoje:** o preventivo depende de alguém lembrar; uma obrigação legal esquecida vira multa ou
  contrato perdido.
- **Com o OS:** o plano roda sozinho e **avisa** o que vence.
- **Poder/Valor:** dormir tranquilo sabendo que nenhuma obrigação legal passou batido. Diferencial de
  venda raro nos concorrentes.

#### Calendário de Manutenção (compacto + anual)
Duas visões: compacta (próxima data) e calendário (grid mensal/anual com status colorido). Detalhe em
*PCM — Calendário de Manutenção Preventiva (Requisito Visual)*.
- **Poder:** **provar visualmente** ao cliente o que está em dia — material de assembleia pronto.

#### Cronograma & Visitas (+ roteirização)
Grade semanal; agendamento por cliente/turno/técnico com os itens de backlog a executar; planejamento
enviado por WhatsApp; registro de resultado por item. **Otimização de rota** via Google Maps (§6.11)
antes de despachar para o Auvo.
- **Poder:** planejar a semana da equipe com critério e a rota do dia com menos deslocamento.
- **Valor:** mais visitas/dia por técnico = mais receita pela mesma folha.

#### Relatórios — *prestação de contas sem trabalho manual* ⭐
Quatro saídas, todas com a **marca do cliente** (logo do condomínio):
- **Relatório de Visita / Atendimento** — gerado ao fechar a visita/OS, com o que foi feito e fotos
  antes/depois.
- **Relatório Diário** — um por (técnico, cliente, dia), texto por IA, enviado ao grupo do condomínio.
- **Relatório Mensal** — PDF do período (OS, preventivas cumpridas, SLA, NPS, assinatura), batch agendado.
- **Relatório sob demanda (exportável)** — o escritório escolhe **cliente + período + conteúdo** e
  exporta um PDF/Excel pronto para enviar por WhatsApp, e-mail ou disponibilizar no portal.
- **Hoje:** todo relatório é montado à mão, copiando de vários lugares — trabalho que ninguém quer fazer.
- **Com o OS:** clica, gera, envia.
- **Poder:** prestar contas com aparência profissional sempre que o cliente pedir, sem esforço.
- **Valor:** o relatório é a **prova do serviço** que justifica o contrato e segura o cliente na
  renovação. *Atende a dor C2 e o pedido explícito de "extrair relatório para enviar ao cliente".*

#### Gestão de Contrato: Previsto × Realizado
O contrato define escopo (ex.: 4 visitas/mês, sistemas X e Y, preventivos Z). O OS acompanha o que foi
**efetivamente entregue** vs o **contratado**.
- **Hoje:** ninguém sabe ao certo se entregou o que vendeu — descobre-se na hora da renovação ou da
  reclamação.
- **Com o OS:** um placar de cumprimento do contrato, por cliente.
- **Poder/Valor:** evita entregar a mais (prejuízo) e a menos (churn/quebra de contrato); embasa o
  faturamento e a renovação com dado.

#### Onboarding de Contrato Novo
Roteiro guiado ao ativar um contrato: cadastrar condomínio, mapear ativos, montar plano preventivo,
vincular grupo de WhatsApp, criar acesso ao portal.
- **Valor:** um cliente novo entra **operacional em horas, não em semanas**, e com padrão — sem
  depender da memória de quem cadastrou.

#### Equipe & Técnicos
Espelho dos técnicos (fonte Auvo) enriquecido com **competências/skills** e **disponibilidade**.
- **Por que importa:** a roteirização e a alocação inteligente precisam saber *quem sabe fazer o quê* e
  *quem está livre quando*. Também alimenta produtividade por técnico (§6.11).

#### Laudos Técnicos
SPDA (NBR 5419:2026, wizard de 8 etapas, cálculo de risco, assinatura com hash) e, futuramente, outros
laudos de conformidade (PMOC, água) — ver §9.

---

**Entidades principais:** Administradora, Cliente/Condomínio, Contrato, Equipamento/Ativo, Garantia,
Backlog Item, Visita, Ordem de Serviço, Orçamento, Inspeção, Plano Preventivo (e PMOC), Relatório
(visita/diário/mensal/sob-demanda), Técnico, Laudo.

**Regras de negócio-chave:**
- Idempotência PCM→Auvo via `externalId = os.id` (reenviar nunca duplica).
- Inspeção não-conforme → backlog com `origem = inspecao`.
- OS preventiva atrasada (data passada + status ≠ finalizado) = pendência no calendário.
- Corretiva no mesmo equipamento dentro do prazo de garantia → flag de garantia (não fatura, conta como
  retrabalho).
- Custo/peça fora do escopo do contrato → exige orçamento aprovado antes de executar.

**Indicadores:** SLA (abertura→despacho→execução→fechamento), % preventivo cumprido, backlog em
semanas, taxa de não-conformidade, aderência ao PMOC, **cumprimento de contrato (previsto×realizado),
taxa de retrabalho em garantia, tempo de aprovação de orçamento**.

---

### 6.2. Atendimento — *Agentes de IA*

**Dor:** o relacionamento (entrada de chamado, qualificação de lead, condução de venda, pós-venda)
depende de gente disponível e se perde em conversas de WhatsApp.

O contrato (cláusula 3.1.2) prevê **múltiplos agentes de IA**, não só o Zé. Proposta de papéis:

| Agente | Papel | Canal | Status |
|--------|-------|-------|--------|
| **Zé (Operacional)** | Abre/atualiza chamados de manutenção dos clientes ativos | WhatsApp (grupos/DM) | Existe — em evolução |
| **SDR (Qualificação)** | Recebe e qualifica leads no topo do funil | WhatsApp / web / social — *a definir* | A escopar |
| **Closer (Vendas)** | Conduz a proposta, tira dúvidas, acelera o fechamento | WhatsApp / e-mail — *a definir* | A escopar |
| **CS (Pós-venda)** | Acompanha satisfação, antecipa churn, coleta NPS | WhatsApp / portal — *a definir* | A escopar |
| **Apoio ao Técnico** | Responde dúvida técnica, ajuda diagnóstico por foto, procedimento/norma | *Canal a definir (WhatsApp do técnico? dentro do OS?)* | A escopar (dor T2 e cláusula 3.1.5) |

**Zé — regras já desenhadas:**
- Detecção determinística de menção **antes** do LLM (regex `\bz[eé]\b` ou `@bot`).
- Modos por condomínio: `off` / `monitor` (só se chamado) / `active` (responde a qualquer
  referência a serviço).
- Só abre OS após confirmar **problema + local + urgência**; idempotente por chat.
- Fila com agrupamento de rajada (3–8s); fallback por cron; latência alvo <10s.
- Tools: `criar_chamado`, `atualizar_chamado`, `consultar_chamados`, `consultar_backlog`.

**Decisões em aberto (ver §11):** canais e fronteiras dos agentes SDR/Closer/CS; se são um schema
próprio ou extensão do Zé; o que exatamente o agente de apoio ao técnico faz.

**Entidades:** mensagem (wa_messages), fila (wa_queue), config de agente, vínculo grupo↔cliente,
admins de DM.

**Indicadores:** latência de resposta, taxa de abertura completa de chamado, taxa de qualificação de
lead (SDR), conversão assistida (closer), NPS coletado (CS).

---

### 6.3. Comercial (CRM)

**Dor:** o funil de vendas não é gerido; proposta sai lenta e sem padrão de preço; não se sabe a
origem dos bons clientes.

**Funcionalidades:**
- **Funil/Pipeline** — prospect → lead qualificado → proposta → negociação → contrato (ganho/perdido),
  com motivo de perda.
- **Propostas (4 tipos)** — convergem em uma proposta salva e exportável (DOCX):
  - **Levantamento de campo** — chat com IA + fotos + notas + disciplinas → proposta gerada (Gemini).
  - **Volante** — cálculo dinâmico (técnicos × frequência × nível × margem).
  - **Residente** — cálculo (nível + cobertura + margem) para posto fixo no local.
  - **Simples** — formulário manual (legado).
- **Motor de Precificação:** `Custo Total (MO + Benefícios + Material + Veículo + Suporte) × (1+Margem)
  ÷ (1 − Alíquota Anexo IV Simples)`; piso = custo com gross-up de imposto; desconto máx = 1 − Piso/Preço.
- **Contratos** — geração a partir da proposta aceita; tipos (residente, volante, avulso); recorrência,
  reajuste, vigência, escopo (sistemas cobertos, periodicidades).
- **Fluxo único** (exigência contratual 3.1.1) — do lead ao contrato sem trocar de ferramenta.

**Integração:** Comercial → Financeiro (proposta aceita/contrato → faturamento recorrente);
Comercial → PCM (contrato ativo → cria cliente/condomínio e plano preventivo).

**Indicadores:** taxa de conversão por etapa, ciclo de venda, ticket médio, win/loss por motivo,
desconto médio vs piso, origem do lead (com Growth).

---

### 6.4. Operação & Estoque (Almoxarifado: Peças + Ferramentas)

**Dor:** retrabalho por falta de peça; custo de material por OS desconhecido; sem controle de
catálogo nem de saldo; **e ferramentas caras circulando sem dono.**

> **Distinção conceitual importante.** Uma **peça** é consumível: sai do estoque, é instalada e vira
> custo da OS (não volta). Uma **ferramenta** é um ativo durável: é **emprestada e devolvida**, tem
> dono/custódia em cada momento e um histórico de quem a teve. São entidades diferentes — o módulo
> trata as duas, mas com lógicas distintas.

#### 6.4.1. Peças & Materiais (consumíveis)
- **Catálogo** (custo, unidade, fornecedor).
- **Estoque** — saldo, entradas/saídas, mínimo, ponto de reposição; opcional por técnico/van.
- **Consumo por OS** — peças usadas em campo (vindas do Auvo) baixam estoque e compõem o custo da OS.
- **Separação por visita** — peças previstas para a visita planejada.
- **Compras** (a confirmar) — sugestão de reposição quando abaixo do mínimo.

#### 6.4.2. Ferramentas & Kits (ativos duráveis) — *dor O7*
- **Cadastro de ferramenta** — nome, nº de patrimônio/série, foto, valor, status
  (disponível / em uso / em manutenção / em calibração / extraviada / baixada).
- **Classificação em dois eixos:**
  - **Por controle:** **comum** (baixo valor, cada técnico tem o seu — controle leve) vs
    **específico** (cara/crítica, compartilhada — controle individual rígido).
  - **Por categoria técnica:** climatização, elétrica, hidráulica, medição/instrumentação, EPI, civil.
- **Kits** — agrupam **N ferramentas** numa unidade atribuível (ex.: *Kit Climatização* = manifold +
  recolhedora de gás + vacuômetro + multímetro + furadeira). O kit inteiro é atribuído a um
  técnico ou veículo de uma vez.
- **Custódia / posse em tempo real** — onde está cada ferramenta/kit **agora**: técnico, veículo,
  almoxarifado, em manutenção, no cliente.
- **Empréstimo & devolução (check-out / check-in)** — quem pegou, quando, condição na saída,
  previsão e data efetiva de devolução, condição na volta.
- **Histórico de posse (chain of custody)** — linha do tempo de cada ferramenta: todos que já a
  tiveram, quando, em qual OS/visita.
- **Vínculo com OS/visita** — quais ferramentas saíram para qual trabalho.
- **Calibração / manutenção de instrumentos** — instrumentos de medição (megômetro, manifold,
  alicate amperímetro) têm **validade de calibração**; o sistema controla o vencimento e alerta
  (conecta com o painel de conformidade, §9).
- **Alertas** — ferramenta não devolvida no prazo, calibração vencida, item dado como extraviado.

**Entidades:** Material/Peça, MovimentaçãoEstoque, Ferramenta, Kit, Categoria, Custódia,
MovimentaçãoFerramenta (empréstimo/devolução), Calibração.

**Integração:** Auvo devolve peças consumidas por tarefa; PCM associa à OS; Financeiro usa para
custo; ferramentas previstas entram no planejamento da visita.

**Indicadores:** giro de estoque, custo de material por OS, ruptura (OS parada por falta de peça),
**taxa de devolução de ferramentas, ferramentas extraviadas/ano, custo de reposição de ferramental,
% de instrumentos com calibração vigente.**

---

### 6.5. Financeiro

**Dor (L2, L6):** não se sabe se o contrato é lucrativo; faturamento manual; sem fluxo de caixa.

> **Atenção de escopo:** o contrato (3.1.6) pede **contas a pagar e a receber, faturamento, fluxo de
> caixa e conciliação**. O blueprint atual cobre só o lado a receber + rentabilidade. Os itens novos
> (pagar, caixa, conciliação) precisam de definição de escopo mínimo para o go-live — ver §11.

**Funcionalidades:**
- **Contas a Receber** — fatura por contrato/período; vencimento por cliente; baixa no pagamento;
  inadimplência com alertas (D+3/D+7/D+15); bloqueio opcional de novas OS em atraso.
- **Faturamento** — gerado a partir de OS finalizadas e/ou contrato recorrente; integração com NF-e
  (a definir — pode ser integração, não reconstrução).
- **Contas a Pagar** — fornecedores, despesas (combustível, benefícios, peças, terceiros).
- **Fluxo de Caixa** — entradas e saídas, previsto vs realizado, posição de caixa.
- **Conciliação** — extrato bancário × lançamentos (mínimo: importação CSV/OFX, baixa manual).
- **Custo & Rentabilidade** — custo real por OS (MO + material + deslocamento) consolidado por
  contrato; margem; alerta de margem negativa por 2 meses consecutivos.

**Integração:** PCM (OS finalizada → custo), Estoque (material), Comercial (contrato → receita),
Auvo (peças/horas), Gestão (alimenta o caixa do Cockpit).

**Indicadores:** margem por contrato, inadimplência, ticket médio de corretiva, DSO (prazo médio de
recebimento), posição de caixa projetada.

---

### 6.6. Marketing (Conteúdo Multicanal)

**Dor:** marketing reativo, sem constância; produzir post é trabalhoso e some quando a operação aperta.

**Motor de conteúdo: Jimmy Studio.** A produção de conteúdo do OS é feita **absorvendo o Jimmy Studio**
para dentro do módulo Marketing. É ele quem gera o conteúdo de ponta a ponta — redação → arte/imagem →
peça pronta — com foco em **Instagram e LinkedIn** (o LinkedIn faz sentido pelo perfil B2B de manutenção
predial: administradoras, síndicos profissionais, gestores prediais).

**Funcionalidades:**
- **Geração de conteúdo via Jimmy Studio** — pauta/redação + geração de imagem, produzindo a peça pronta
  para publicar.
- **Canais foco:** **Instagram** e **LinkedIn** (Facebook e outros, se/quando fizer sentido).
- **Calendário editorial** com fluxo de **aprovação humana** antes de publicar.
- **Publicação/agendamento** nos canais conectados.
- **Biblioteca de marca** — tom de voz, identidade visual, templates da Sinérgica.

**Integração:** **Jimmy Studio** (motor de geração), Growth (resultado dos posts/anúncios), Comercial
(lead gerado por conteúdo).

> **A confirmar (ver §11 · D9):** o **modelo de integração do Jimmy Studio** — ele é embarcado dentro
> do OS (UI própria), consumido por API, ou roda ao lado e o OS orquestra? E o nível de automação de
> publicação (gera+agenda com aprovação vs publica direto). Definir antes de abrir a spec do módulo.

**Indicadores:** cadência de publicação, alcance/engajamento, leads atribuídos a conteúdo.

---

### 6.7. Growth (Análise de Anúncios)

**Dor (G4):** verba de Meta/Google Ads gasta sem leitura clara de retorno.

**Funcionalidades:**
- **Conexão Meta Ads + Google Ads** (APIs).
- **Leitura e análise** de campanhas (gasto, CPL, CTR, conversão).
- **Atribuição de leads** — canal/campanha → proposta → contrato (amarra com o Comercial).
- **Orientação de investimento** — onde colocar/retirar verba.

**Indicadores:** CPL por canal, CAC, ROAS, % de receita atribuível a cada canal.

---

### 6.8. Gestão (Cockpit / Painel de Indicadores)

**Dor:** a liderança não tem visão executiva consolidada.

**Funcionalidades:** painel gerencial com **operação** (SLA, OS abertas, produtividade do técnico,
aderência ao preventivo), **margem** (rentabilidade por contrato), **atrasos** (SLA estourado,
inadimplência), **funil** (comercial), **caixa** (financeiro). Visões por período, por cliente, por
técnico, por sistema. Tecnicamente são **views** sobre os schemas dos outros módulos (não duplica dado).

**Indicadores-chave do negócio:** receita recorrente (MRR), churn, margem média, backlog total em
semanas, % preventivo cumprido, NPS, posição de caixa.

---

### 6.9. Área do Cliente (Portal do Síndico)

**Dor (C1–C4):** o cliente não enxerga o serviço e cobra prova.

**Funcionalidades (read-only + abrir chamado):**
- **Painel do condomínio** — OS abertas, backlog visível, preventivo do mês.
- **Histórico de OS** — com filtros; fotos antes/depois.
- **Documentos** — relatórios mensais, laudos (SPDA/PMOC), certificados — download (signed URL).
- **Situação financeira** — faturas, vencimentos, comprovantes (exige views de `financeiro` para o
  papel `cliente-sindico`).
- **Abrir chamado** — formulário web (alternativa ao Zé).

**Regras de acesso:** RLS restrita ao próprio condomínio; sem dados internos (custo, rentabilidade,
backlog de priorização). Mobile-first.

---

### 6.10. Dados (Base Única)

**O que é:** a fundação. Todos os módulos gravam na mesma base (Supabase, schemas por domínio), o que
torna a operação **uma fonte única de verdade** — e é dessa base que os Agentes de IA tiram contexto.

> **Decisão de produto (§11):** o contrato lista "Dados" como **módulo**. Definir se é só o princípio
> arquitetural (sem tela) ou se há entregável visível — ex.: painel de **qualidade de dados**
> (duplicatas, campos faltantes, última sincronização com o Auvo) e **configuração de contexto da IA**.

**Governança:** RLS FORCE em toda tabela; colunas de auditoria; `audit.*` append-only; LGPD
(consentimento, export/delete); espelhos de cache (Auvo) só-leitura no app.

---

### 6.11. Inteligência da Operação & Roteirização — *a base única virando decisão*

**Tese.** O módulo Dados (§6.10) é a **fundação**; esta camada é o que faz a fundação **valer a pena**.
Ter tudo numa base só não serve de nada se não vira decisão. Aqui o dado vira inteligência.

**Princípio de captura — "garbage in, garbage out".** A qualidade da inteligência depende da
**disciplina na captura**. Por isso o sistema é desenhado, desde o cadastro, pensando no que a IA vai
precisar depois:
- Endereço de cliente **geocodificado** (lat/long) já no cadastro — habilita roteirização e mapa.
- Histórico por equipamento **estruturado** (intervenção, peça, sintoma) — não texto livre — habilita
  preditiva.
- **Tempo real de execução** (vindo do Auvo) — habilita produtividade e previsão.
- **Competências/skills** do técnico cadastradas — habilitam alocação inteligente.

**Capacidades de inteligência:**

| # | Capacidade | O que faz | Dado necessário | Fonte |
|---|-----------|-----------|-----------------|-------|
| 1 | **Roteirização** *(carro-chefe)* | Otimiza a sequência de visitas do dia por técnico, minimizando deslocamento | Endereços geocodificados, janelas de turno, base do técnico, prioridade | **Google Maps Platform** + PCM |
| 2 | **Manutenção preditiva** | Sinaliza equipamento com falha recorrente para troca/overhaul | Histórico estruturado por ativo | PCM (ativos + OS) |
| 3 | **Repriorização do backlog** | Sugere reordenação por GUT + idade + recorrência + impacto financeiro | Backlog + histórico + custo | PCM + Financeiro |
| 4 | **Previsão de demanda** | Antecipa carga corretiva e necessidade de peças | Sazonalidade, histórico de chamados | PCM + Estoque |
| 5 | **Antecipação de churn** | Detecta clientes em risco (queda de NPS, reclamações, atrasos) | NPS, comunicação, SLA | Atendimento + Gestão |
| 6 | **Inteligência de rentabilidade** | Aponta quais contratos/serviços/clientes dão lucro | Custo real × receita | Financeiro |
| 7 | **Produtividade do técnico** | Tempo por tarefa, ociosidade, % deslocamento | Tempo de execução, GPS | Auvo → PCM |

#### Roteirização — detalhe (integração Google Maps)
- **APIs:** Geocoding (endereço → lat/long), Distance Matrix / Routes (tempo e distância entre pontos,
  com trânsito), opcional Route Optimization.
- **Onde roda:** no **planejamento do PCM** (Cronograma/Visitas), **antes** de empurrar as tarefas
  para o Auvo. O OS monta a rota ótima; o Auvo executa e devolve o GPS real.
- **Entrada:** visitas agendadas do dia, base/origem do técnico, janelas de turno (manhã/tarde),
  prioridade dos itens, competência exigida vs competência do técnico.
- **Saída:** ordem ótima das visitas + ETA + km estimado por rota; visualização em mapa.
- **Cuidados:** custo por chamada de API → **cachear a matriz de distância** entre clientes fixos
  (mudam pouco); respeitar quota; geocodificar uma vez e persistir.

> **Por que isso importa para a Sinérgica:** roteirização reduz hora-deslocamento (custo direto) e
> aumenta nº de visitas/dia por técnico (receita). É das alavancas de margem mais diretas numa
> operação volante.

**Decisões em aberto:** custo/quota do Google Maps e nível de otimização desejado — ver §11 (D11).

---

### 6.12. Capacidades Transversais

Recursos que **não são um módulo**, mas servem a todos — e que, se não existirem, cada módulo
reinventa pior. São baratos de construir uma vez e usados em todo lugar.

#### Central de Alertas & Notificações
Um lugar só que dispara e consolida os avisos que hoje vivem na cabeça das pessoas: SLA estourando,
preventivo/PMOC vencendo, inadimplência, ferramenta não devolvida, calibração vencida, orçamento
aguardando aprovação, margem de contrato negativa.
- **Valor:** a operação passa a ser **empurrada por exceção** — o sistema chama atenção para o que
  precisa de ação, em vez de depender de alguém varrer planilhas. Canais: in-app, WhatsApp, e-mail.

#### Motor de Relatórios & Exportação
Componente compartilhado que gera os documentos do OS (relatórios de PCM, financeiros, de conformidade)
em **PDF/Excel com a marca certa** (Sinérgica ou logo do cliente), enviáveis por WhatsApp/e-mail ou
publicados no portal.
- **Valor:** "extrair e mandar para o cliente" vira um clique em qualquer parte do sistema, não um
  retrabalho manual por módulo.

#### Gestão Documental
Repositório dos documentos da operação: contratos, ARTs, laudos, certificados de conformidade, manuais
de equipamento, fotos de OS — vinculados ao cliente/equipamento certo, com acesso por papel.
- **Valor:** acha-se qualquer documento pela Visão 360; o que é do cliente aparece no portal dele.

#### Busca Global
Uma caixa de busca que encontra cliente, OS, equipamento, contrato ou documento de qualquer tela.
- **Valor:** elimina o "em que menu estava aquilo?" — velocidade de quem usa o sistema o dia todo.

> Estas capacidades entram **incrementalmente**, conforme os módulos que as consomem são construídos —
> não são um épico isolado no começo.

---

## 7. Integração com o Auvo (a fronteira)

Resumo (detalhe completo em *Mapeamento Auvo x PCM como Hub (29-06-2026)*):

- **PCM → Auvo (escrita):** cria/atualiza cliente, equipamento, tarefa, preventivo (Service Order),
  orçamento, NF, conta a receber. Cobertura total da API.
- **Auvo → PCM (webhook):** só 6 entidades (User, Task, Customer, Equipment, Invoice, Ticket).
  Webhook é "magro" → ao receber, o PCM faz `GET` para puxar o detalhe (foto, checklist, peça).
- **Auvo → PCM (polling):** o que não tem webhook — preventivo recorrente, checklist, GPS, orçamento,
  contas a receber, despesas, NPS.
- **Fronteira fixa:** o campo (check-in/out, foto, assinatura, checklist) é **sempre** no app Auvo.
- **Cuidados críticos:** segurança do webhook (7 camadas — token na URL, reconsulta GET, idempotência,
  só-enfileirar, rate-limit, não-logar-segredo, rotação); eco/loop (idempotência por `externalId`);
  token expira 30 min; rate limit 400 req/min/IP compartilhado.

---

## 8. Papéis e Permissões

| Papel | Acesso |
|-------|--------|
| `admin` | Total — configura agentes de IA, integrações, usuários, parâmetros |
| `escritorio` | Operacional — clientes, chamados, backlog, visitas, propostas, relatórios, financeiro |
| `comercial` | Funil, propostas, contratos (pode ser refinamento de `escritorio`) |
| `tecnico` | Restrito — leitura geral + escrita no próprio (OS, inspeções) + agente de apoio |
| `cliente-sindico` | Portal + WhatsApp (Zé) — só dados do próprio condomínio |

Princípio: **menor privilégio**; dado financeiro sensível nunca exposto ao síndico além da própria
situação; RLS por condomínio.

---

## 9. Conformidade Legal & Laudos (diferencial de domínio)

Empresa de manutenção predial/HVAC vive de cumprir obrigações com **prazo legal**. Tratar isso como
módulo de primeira classe é um diferencial competitivo. *Os marcos abaixo devem ser validados com a
engenharia da Sinérgica antes de virar regra rígida no sistema — periodicidades variam por município
e por norma vigente.*

| Obrigação | O que é | Por que importa no OS |
|-----------|---------|----------------------|
| **PMOC** | Plano de Manutenção, Operação e Controle de climatização (Lei Fed. 13.589/2018) | Obrigatório para sistemas de AC de uso coletivo/acima de porte. O preventivo de AC **é** o PMOC — precisa de plano documentado, responsável técnico (ART) e registro das atividades |
| **QAI** | Qualidade do Ar Interior (base ANVISA RE 9/2003) | Limpeza de dutos/filtros, análise — entra como rotina preventiva e laudo |
| **SPDA** | Sistema de Proteção contra Descargas Atmosféricas (NBR 5419) | Inspeção periódica + laudo; já há wizard no PCM |
| **Análise de água / Legionella** | Limpeza de reservatório (geralmente semestral, varia por município) e torres de resfriamento | Rotina preventiva + laudo de potabilidade |
| **AVCB / sistema de incêndio** | Auto de Vistoria do Corpo de Bombeiros, extintores, hidrantes | Controle de vencimento + alerta |
| **NR-13** | Vasos de pressão e caldeiras | Inspeção por profissional habilitado, registro |
| **ART / TRT** | Anotação de Responsabilidade Técnica (CREA) | Vinculada a laudos e contratos |

**Funcionalidade transversal:** um **painel de conformidade** por cliente, com o que está em dia, o
que vence e quando — alimentando alertas e o Cockpit. Responde diretamente à dor L8.

---

## 10. Roadmap de Construção (fases)

> Alinhado ao cronograma contratual (Mês 1 diagnóstico/casca ✅ · Mês 2 construção · Mês 3 ativação) e
> ao roadmap técnico do hub Auvo. Granularidade fina vive em `docs/epics/ROADMAP.md`.

### Fase 1 — Espinha dorsal operacional (loop mínimo)
PCM (Visão 360, clientes, ativos, backlog GUT, OS Kanban) + integração Auvo fase 1 (criar tarefa,
sync cliente/equipamento, webhook seguro) + Agente Zé (abertura de chamado). **Entrega:** abrir OS no
OS → vira tarefa no Auvo → técnico executa → volta sozinho.

### Fase 2 — Fechar o operacional + comercial
Visitas/cronograma, inspeção com IA, calendário preventivo/PMOC, relatórios diário/mensal; CRM
(funil + propostas migradas); Estoque (consumo por OS); polling Auvo (preventivo, GPS, checklist).

### Fase 3 — Ciclo financeiro
Custo por OS, rentabilidade, contas a receber, faturamento; depois contas a pagar, fluxo de caixa,
conciliação. Orçamento/NF/satisfação via Auvo.

### Fase 4 — Crescimento e cliente
Marketing (conteúdo multicanal), Growth (Meta/Google Ads), Área do Cliente (portal), Cockpit
executivo; agentes comerciais (SDR/closer/CS) e agente de apoio ao técnico. Go-live.

---

## 11. Decisões em Aberto — Roteiro de Entrevista com o Fabrício

> Cada item traz a **pergunta** para o Fabrício **e** a **Recomendação** — o que 
> responderíamos como especialistas do setor, para o cliente reagir a uma proposta concreta em vez de
> partir do zero. Bloqueadores de produto, não técnicos. Origem em
> *Sinérgica OS — Escopo Contratual (Cláusula 3ª)*.

**D1 — Agentes comerciais (SDR / Closer / CS)**
- *Pergunta:* Quais papéis a Sinérgica quer? Em quais canais? Agente próprio ou extensão do Zé?
- *Recomendação Trívia:* Começar **só com o SDR** (qualificação) no mesmo canal onde o lead chega
  (WhatsApp). Closer e CS na Fase 4. Arquitetura: **agente separado do Zé** (contexto e objetivo
  diferentes — Zé é operacional/pós-contrato; SDR é pré-venda), mas **mesma infraestrutura** de fila e
  tools. Evita reescrever o motor de conversa.

**D2 — Agente de apoio ao técnico**
- *Pergunta:* O que faz (dúvida técnica, diagnóstico por foto, procedimento/norma)? Por qual canal?
- *Recomendação Trívia:* MVP = **assistente de procedimento e norma** via WhatsApp do técnico
  ("como faço a limpeza do evaporador do chiller X?" / "qual a periodicidade PMOC para fan-coil?").
  Diagnóstico por foto é alto valor mas exige curadoria — Fase 4. Não competir com o app Auvo; o
  agente **complementa** com conhecimento, não com registro.

**D3 — Financeiro completo (pagar / caixa / conciliação)**
- *Pergunta:* Escopo mínimo para o go-live? Integra com banco ou só importação?
- *Recomendação Trívia:* Go-live com **receber + faturamento + rentabilidade por contrato** (o que
  ataca a dor L2/L6). Contas a pagar e fluxo de caixa = **lançamento manual + importação CSV/OFX** do
  extrato, com conciliação por baixa manual. **Sem integração bancária direta (Open Finance)** no V1 —
  é projeto à parte. Margem por contrato é o indicador que muda o jogo; priorizar ele.

**D4 — Módulo Dados (Base Única)**
- *Pergunta:* É só arquitetura (sem tela) ou tem entregável visível?
- *Recomendação Trívia:* É **fundação arquitetural** (Supabase, schemas por domínio) **+** uma tela
  enxuta de **qualidade de dados**: duplicatas de cliente/equipamento, cadastros incompletos, última
  sincronização com o Auvo. Vender "Dados" como módulo sem nenhuma tela frustra a percepção de
  entrega — a tela de saúde de dados materializa o valor. A inteligência (§6.11) é a prova viva de que
  a base única serve para algo.

**D5 — Portal: situação financeira do síndico**
- *Pergunta:* Quais dados financeiros o síndico vê?
- *Recomendação Trívia:* Faturas do próprio condomínio, vencimentos, status (pago/em aberto) e
  comprovante/2ª via. **Nunca** custo interno, margem ou rentabilidade. Views RLS dedicadas em
  `financeiro` para o papel `cliente-sindico`.

**D6 — Portal: documentos**
- *Pergunta:* Quais documentos ficam disponíveis ao cliente?
- *Recomendação Trívia:* Relatórios mensais, **laudos de conformidade (SPDA, PMOC, análise de água)**
  e certificados. É exatamente a "prova para a assembleia" (dor C2) — alto valor percebido. Contrato
  vigente também, se o Fabrício topar. Tudo por signed URL com expiração.

**D7 — Conformidade legal (§9)**
- *Pergunta:* Quais obrigações a Sinérgica controla hoje? Quais periodicidades valem?
- *Recomendação Trívia:* Mapear com a engenharia da Sinérgica o conjunto real (provavelmente PMOC,
  SPDA, limpeza de reservatório, AVCB). Tratar como **catálogo configurável de obrigações** (tipo +
  periodicidade + responsável + laudo gerado), não hard-coded — cada cliente tem um subconjunto. O
  painel de conformidade com alerta de vencimento é um **diferencial de venda** raro nos concorrentes.

**D8 — NF-e**
- *Pergunta:* Emissão de nota é integração ou reconstrução no OS?
- *Recomendação Trívia:* **Integração**, nunca reconstrução. Conectar a um emissor existente (ex.: o
  que a contabilidade já usa) ou a uma API de NF-e. Reconstruir emissor fiscal é poço sem fundo e fora
  do valor central do OS.

**D9 — Marketing: Jimmy Studio, canais e automação**
- *Definido:* canais foco = **Instagram + LinkedIn**; motor de conteúdo = **Jimmy Studio** absorvido no
  módulo Marketing.
- *Pergunta:* Qual o **modelo de integração do Jimmy Studio** (embarcado no OS / via API / orquestrado ao
  lado)? Qual o nível de automação de publicação? Já existe Meta Business / gestor de páginas configurado?
- *Recomendação Trívia:* V1 = Jimmy Studio gera (texto + imagem) + **agendamento com aprovação humana**;
  publicação 100% automática só depois que o fluxo de aprovação estiver maduro. Sobre a integração,
  preferir **consumo por API** (acopla menos e deixa o Jimmy Studio evoluir sozinho) — confirmar
  viabilidade com quem mantém o Jimmy Studio.

**D10 — Calendário preventivo: conteúdo da célula**
- *Decidido:* MVP só **cor + ícone**; código de atividade e mapeamento com tipos do Auvo ficam para
  quando soubermos o que o webhook devolve. (Ver *PCM — Calendário de Manutenção Preventiva (Requisito Visual)*.)

**D11 — Roteirização: custo e nível de otimização (Google Maps)**
- *Pergunta:* Qual o orçamento aceitável de API e o nível de otimização desejado?
- *Recomendação Trívia:* Começar com **otimização simples** (ordenar visitas por menor deslocamento
  via Distance Matrix, com cache da matriz entre clientes fixos) — barato e já entrega o ganho. Route
  Optimization API (otimização multi-restrição) só se o volume justificar. Geocodificar endereços uma
  única vez no cadastro. Avaliar Google Maps Platform vs alternativas (Mapbox) por custo/quota.

**D12 — Ferramentas: profundidade do controle**
- *Pergunta:* Controla ferramenta **comum** também ou só a **específica** (cara/crítica)? Calibração
  de instrumentos entra no V1?
- *Recomendação Trívia:* V1 controla **rigorosamente a específica** (custódia individual, histórico,
  alerta de não-devolução) e trata a **comum** como saldo por técnico/kit (controle leve). Calibração
  de instrumentos = incluir já no V1 o **alerta de vencimento** (baixo esforço, conecta com
  conformidade e evita laudo invalidado por instrumento descalibrado).

**D13 — Garantia de serviço: prazo**
- *Pergunta:* Qual o prazo padrão de garantia de um serviço/corretiva? Varia por tipo de serviço ou
  por contrato?
- *Recomendação Trívia:* Definir um **prazo padrão configurável** (ex.: 90 dias, alinhado ao CDC para
  serviços) com possibilidade de exceção por tipo de serviço. O essencial do V1 é o **flag automático**
  de retrabalho dentro do prazo — o número exato é parâmetro, não trava o desenvolvimento.

**D14 — Aprovação de orçamento: alçada**
- *Pergunta:* Existe um valor abaixo do qual o escritório executa sem precisar da aprovação do síndico?
- *Recomendação Trívia:* Sim — **limite de alçada configurável por contrato** (ex.: até R$ X, executa e
  informa; acima, exige aprovação do cliente). Reduz fricção no dia a dia sem perder controle nos
  gastos relevantes.

**D15 — Gestão de ativos: ficha técnica e hierarquia**
- *Pergunta:* Quais campos da ficha de equipamento são obrigatórios para a Sinérgica (marca, modelo,
  nº de série, capacidade/BTU, fabricante, data de instalação…)? A hierarquia `Torre/Bloco → Área →
  Sistema → Equipamento` reflete como vocês organizam os prédios?
- *Recomendação Trívia:* Ficha enxuta obrigatória (tipo, identificação, localização, capacidade) +
  campos opcionais ricos (fotos, QR, manuais, garantia). Hierarquia **configurável** — nem todo
  condomínio tem "Torre"; tratar a localização como níveis flexíveis. Como o PCM passa a ser **dono**
  do ativo (e empurra para o Auvo), confirmar com o Fabrício a migração dos equipamentos que hoje
  vivem no Auvo para o cadastro mestre do OS.

---

## 12. Glossário rápido

- **OS** — Ordem de Serviço.
- **PCM** — Planejamento e Controle de Manutenção (módulo espinha dorsal).
- **PMOC** — Plano de Manutenção, Operação e Controle (climatização, obrigatório).
- **SPDA** — Sistema de Proteção contra Descargas Atmosféricas (para-raios).
- **GUT** — Gravidade, Urgência, Tendência (matriz de priorização).
- **Posto residente** — técnico fixo alocado no cliente. **Volante** — técnico em rota de visitas.
- **Backlog** — itens de manutenção pendentes, priorizados.
- **Origin of truth** — sistema que é dono autoritativo de um dado.
- **Zé** — agente de IA de atendimento no WhatsApp.
- **Kit (de ferramentas)** — conjunto de N ferramentas atribuído como unidade a um técnico/veículo.
- **Custódia / chain of custody** — quem detém uma ferramenta a cada momento e o histórico disso.
- **Ferramenta comum × específica** — comum: baixo valor, controle leve. Específica: cara/crítica,
  controle individual rígido.
- **Roteirização** — otimização da sequência de visitas de um técnico para minimizar deslocamento.
- **Geocodificação** — conversão de endereço em coordenadas (lat/long) para mapa e roteirização.

---

## 13. ✅ Checklist de Aprovação do Escopo

> **Para o Fabrício.** Abaixo está cada feature do OS com o **funcionamento em uma linha**. Para cada
> item: **marque `[x]`** se estiver OK, **deixe `[ ]`** se quiser tirar/adiar, e use o **bloco de
> Considerações** ao final de cada módulo para qualquer ajuste, dúvida ou prioridade. O corpo do
> documento (§1–§12) explica cada item em detalhe; as **decisões §11** complementam este checklist.
>
> Legenda de fase: 🟢 Fase 1 (já) · 🔵 Fase 2 · 🟠 Fase 3 · ⚪ Fase 4. *(Ver §10 — é proposta, ajustável.)*

### M1 · PCM / Operação ⭐ *(a espinha dorsal — começa por aqui)*
- [ ] **Visão 360 do Cliente** 🟢 — uma tela por condomínio com contrato, ativos, backlog, OS, preventivo, financeiro e comunicação.
- [ ] **Cadastro de Clientes + Administradora → Condomínio** 🟢 — uma administradora com vários prédios, cada um gerido individualmente.
- [ ] **Gestão de Ativos / Equipamentos do Cliente** 🟢 ⭐ — ficha técnica completa + hierarquia (`Torre → Área → Sistema → Equipamento`) + histórico unificado por ativo + ciclo de vida. *(pedido do Fabrício; hoje só existe espelho do Auvo)*
- [ ] **Controle de Garantia** 🔵 — sinaliza quando um conserto é refeito dentro do prazo (retrabalho a não faturar).
- [ ] **Backlog & Priorização GUT** 🟢 — fila objetiva por Gravidade × Urgência × Tendência, com saúde do contrato.
- [ ] **Ordens de Serviço (Kanban) + sync Auvo** 🟢 — OS vira tarefa no Auvo automaticamente; volta com status/foto/peça.
- [ ] **Aprovação de Orçamento Extra pelo Cliente** 🔵 — síndico aprova custo fora do contrato pelo celular; destrava a OS.
- [ ] **Inspeções com IA → Backlog** 🔵 — foto + descrição viram não-conformidade priorizada e orçável.
- [ ] **Plano Preventivo & PMOC** 🔵 — gera OS recorrentes e avisa o que vence (preventivo de AC = PMOC, obrigatório).
- [ ] **Calendário de Manutenção (compacto + anual)** 🔵 — próxima data e grid mensal/anual com status colorido.
- [ ] **Cronograma & Visitas (+ roteirização)** 🔵 — planejamento semanal por técnico/turno, com rota otimizada.
- [ ] **Relatórios (visita · diário · mensal · sob demanda)** 🔵 — com a logo do cliente, prontos para enviar por WhatsApp/e-mail/portal.
- [ ] **Gestão de Contrato: Previsto × Realizado** 🟠 — placar de "entreguei o que vendi" (visitas/mês, escopo).
- [ ] **Onboarding de Contrato Novo** 🔵 — roteiro guiado: cadastra condomínio, ativos, plano e acessos.
- [ ] **Equipe & Técnicos (skills + disponibilidade)** 🔵 — quem sabe fazer o quê e quem está livre; alimenta roteirização.
- [ ] **Laudos Técnicos (SPDA)** 🟠 — wizard NBR 5419 com cálculo de risco e assinatura.

*Paridade v2 (preservar — já existe no PCM atual, não pode regredir):*
- [ ] **Catálogo de tipos de serviço + decisão de material no levantamento** 🟢 — tipos reais (AC, bomba, ronda…) + quem fornece material (cliente / Sinérgica c/ markup / proposta).
- [ ] **Vínculo de OS pai-filho** 🟢 — corretiva gera/atrela OS filhas.
- [ ] **Estimativa de esforço + citação normativa por IA** 🟢 — backlog/inspeção já calculam horas e citam NBR.
- [ ] **Inspeção por sistema predial (12 sistemas) + análise de foto por IA** 🔵 — vistoria estruturada vira backlog.
- [ ] **Importação de inspeção/laudo legado (PDF e XLS)** 🔵 — migra histórico de papel/planilha via IA.
- [ ] **Rondas recorrentes (diária/semanal)** 🔵 — além do preventivo mensal→anual.
- [ ] **Questionário do Auvo → backlog** 🔵 — checklist de fim de visita gera itens.

> 💬 **Considerações (M1):** ______________________________________________________________

### M2 · Atendimento (Agentes de IA)
- [ ] **Agente Zé (operacional)** 🟢 — abre/atualiza chamado de manutenção via WhatsApp (problema + local + urgência).
- [ ] **Agente SDR (qualificação de lead)** ⚪ — recebe e qualifica leads no topo do funil.
- [ ] **Agente Closer (vendas)** ⚪ — conduz a proposta e acelera o fechamento.
- [ ] **Agente CS (pós-venda / NPS)** ⚪ — acompanha satisfação e antecipa churn.
- [ ] **Agente de Apoio ao Técnico** ⚪ — tira dúvida técnica/norma/procedimento em campo.

> 💬 **Considerações (M2):** ______________________________________________________________

### M3 · Comercial (CRM)
- [ ] **Funil / Pipeline** 🔵 — prospect → proposta → contrato, com motivo de perda.
- [ ] **Propostas (4 tipos: levantamento · volante · residente · simples)** 🔵 — com geração assistida por IA.
- [ ] **Motor de Precificação** 🔵 — preço padronizado (custo + margem + imposto), piso e desconto máximo.
- [ ] **Contratos** 🔵 — gerados da proposta aceita (recorrência, reajuste, vigência, escopo).
- [ ] **Fluxo único (lead → contrato sem trocar de ferramenta)** 🔵 — exigência contratual 3.1.1.

> 💬 **Considerações (M3):** ______________________________________________________________

### M4 · Operação & Estoque (Peças + Ferramentas)
- [ ] **Catálogo de peças/materiais** 🔵 — custo, unidade, fornecedor.
- [ ] **Estoque (saldo, mínimo, reposição)** 🔵 — entradas/saídas, opcional por técnico/van.
- [ ] **Consumo por OS** 🔵 — peça usada em campo baixa estoque e compõe o custo da OS.
- [ ] **Ferramentas: cadastro + classificação (comum/específico)** 🔵 — patrimônio, categoria, status.
- [ ] **Kits de ferramentas** 🔵 — N ferramentas atribuídas como unidade a técnico/veículo.
- [ ] **Custódia + empréstimo/devolução + histórico** 🔵 — quem está com cada ferramenta agora e quem já teve.
- [ ] **Calibração de instrumentos (alerta de vencimento)** 🔵 — megômetro/manifold com validade controlada.

> 💬 **Considerações (M4):** ______________________________________________________________

### M5 · Financeiro
- [ ] **Contas a Receber + inadimplência** 🟠 — fatura por contrato/período, alertas de atraso.
- [ ] **Faturamento** 🟠 — gerado de OS finalizadas e/ou contrato recorrente (NF-e por integração).
- [ ] **Custo & Rentabilidade por contrato** 🟠 — custo real (MO + material + deslocamento) vs receita; alerta de margem negativa.
- [ ] **Contas a Pagar** ⚪ — fornecedores e despesas.
- [ ] **Fluxo de Caixa** ⚪ — entradas/saídas, previsto vs realizado.
- [ ] **Conciliação (CSV/OFX)** ⚪ — extrato bancário × lançamentos, baixa manual.

> 💬 **Considerações (M5):** ______________________________________________________________

### M6 · Marketing
- [ ] **Geração de conteúdo via Jimmy Studio** ⚪ — texto + imagem, peça pronta para publicar.
- [ ] **Calendário editorial + aprovação humana** ⚪ — agenda com revisão antes de publicar.
- [ ] **Publicação Instagram + LinkedIn** ⚪ — nos canais conectados.
- [ ] **Biblioteca de marca** ⚪ — tom de voz, identidade, templates.

> 💬 **Considerações (M6):** ______________________________________________________________

### M7 · Growth (Análise de Anúncios)
- [ ] **Conexão Meta Ads + Google Ads** ⚪ — leitura das campanhas.
- [ ] **Análise de campanhas (gasto, CPL, conversão)** ⚪ — performance por canal.
- [ ] **Atribuição de leads (canal → proposta → contrato)** ⚪ — de onde vêm os bons clientes.
- [ ] **Orientação de investimento** ⚪ — onde colocar/retirar verba.

> 💬 **Considerações (M7):** ______________________________________________________________

### M8 · Gestão (Cockpit / Painel de Indicadores)
- [ ] **Painel executivo** ⚪ — operação, margem, atrasos, funil e caixa num só lugar.
- [ ] **Indicadores de negócio (MRR, churn, NPS, backlog total)** ⚪ — visão de dono.

> 💬 **Considerações (M8):** ______________________________________________________________

### M9 · Área do Cliente (Portal do Síndico)
- [ ] **Painel do condomínio** ⚪ — OS abertas, backlog visível, preventivo do mês.
- [ ] **Histórico de OS (com fotos antes/depois)** ⚪ — transparência do que foi feito.
- [ ] **Documentos (relatórios, laudos, certificados)** ⚪ — prova para a assembleia, por download.
- [ ] **Situação financeira (faturas, vencimentos)** ⚪ — só os dados do próprio condomínio.
- [ ] **Abrir chamado (formulário web)** ⚪ — alternativa ao Zé.

> 💬 **Considerações (M9):** ______________________________________________________________

### M10 · Dados (Base Única)
- [ ] **Base única de dados (fundação)** 🟢 — tudo num só lugar, alimentando os agentes de IA.
- [ ] **Painel de qualidade de dados** 🟠 — duplicatas, cadastros incompletos, última sync com Auvo.

> 💬 **Considerações (M10):** _____________________________________________________________

### M11 · Inteligência & Roteirização
- [ ] **Roteirização (Google Maps)** 🔵 — sequência de visitas do dia com menor deslocamento.
- [ ] **Manutenção preditiva** ⚪ — sinaliza equipamento com falha recorrente.
- [ ] **Repriorização inteligente do backlog** ⚪ — sugestão por GUT + idade + recorrência + custo.
- [ ] **Previsão de demanda (corretiva e peças)** ⚪ — antecipa carga e compras.
- [ ] **Antecipação de churn** ⚪ — detecta cliente em risco.
- [ ] **Inteligência de rentabilidade** ⚪ — quais contratos/serviços/clientes dão lucro.
- [ ] **Produtividade do técnico** ⚪ — tempo por tarefa, ociosidade, deslocamento.

> 💬 **Considerações (M11):** _____________________________________________________________

### MT · Capacidades Transversais *(servem a todos os módulos)*
- [ ] **Central de Alertas & Notificações** 🔵 — SLA, preventivo vencendo, inadimplência, ferramenta não devolvida, orçamento aguardando.
- [ ] **Motor de Relatórios & Exportação** 🔵 — gerar PDF/Excel com a marca certa, em qualquer tela.
- [ ] **Gestão Documental** 🔵 — repositório de contratos, laudos, manuais, fotos por cliente/equipamento.
- [ ] **Busca Global** ⚪ — achar cliente, OS, equipamento ou documento de qualquer lugar.

> 💬 **Considerações (MT):** ______________________________________________________________

---

### Decisões de produto que precisam do seu direcionamento (§11)
Marque as que você consegue decidir agora; o resto a gente fecha na conversa.

- [ ] **D1** — Agentes comerciais (quais papéis/canais)
- [ ] **D2** — O que faz o agente de apoio ao técnico
- [ ] **D3** — Escopo mínimo do Financeiro para o go-live
- [ ] **D4** — Módulo Dados tem tela ou é só arquitetura
- [ ] **D5** — Que dados financeiros o síndico vê no portal
- [ ] **D6** — Quais documentos ficam no portal do cliente
- [ ] **D7** — Quais obrigações legais a Sinérgica controla (conformidade)
- [ ] **D8** — NF-e: qual emissor/integração
- [ ] **D9** — Jimmy Studio: modelo de integração e automação
- [ ] **D10** — Calendário preventivo: conteúdo da célula *(já decidido: MVP cor/ícone)*
- [ ] **D11** — Roteirização: orçamento de API e nível de otimização
- [ ] **D12** — Ferramentas: profundidade do controle e calibração no V1
- [ ] **D13** — Garantia de serviço: prazo padrão
- [ ] **D14** — Aprovação de orçamento: limite de alçada
- [ ] **D15** — Gestão de ativos: quais campos da ficha técnica são obrigatórios (marca, modelo, série, capacidade/BTU…) e a hierarquia de localização da Sinérgica (Torre/Bloco/Área batem?)

> 💬 **Veredito geral / prioridades do Fabrício:** ___________________________________________
>
> ___________________________________________________________________________________________

---

### Resumo da avaliação *(preencher ao final)*
- **Aprovado para iniciar pelo PCM (M1)?**  ☐ Sim   ☐ Sim, com ajustes   ☐ Preciso rever
- **Data da avaliação:** ____ / ____ / ______
- **Próximo passo combinado:** ______________________________________________________________
