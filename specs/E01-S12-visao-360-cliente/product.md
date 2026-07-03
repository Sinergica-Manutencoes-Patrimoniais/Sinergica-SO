---
name: product-E01-S12-visao-360-cliente
description: PRD-lite da Visão 360 do Cliente (v1 realista) — por quê, para quem, e o que dá pra entregar HOJE com o que já existe. Puxe ao revisar escopo desta feature.
alwaysApply: false
---

# Product — Visão 360 do Cliente (v1)

> **Tier:** a definir pelo @architect (provável Pequeno — leitura/agregação sobre tabelas que já
> existem; sem novo bounded context nem migration com dados em produção) · **Status:** rascunho,
> aguardando @architect/aprovação · **Dono:** Lucas (produto) / Claude (sessão Lucas — @pm)
> Responde: **por quê** e **para quem**. Mantém em ~1 página.

## 1. Problema / dor (dor L1 do ESCOPO-MESTRE)

Para falar de um único condomínio hoje, o gestor precisa cruzar **WhatsApp + Auvo + planilha +
memória**. Não existe visão consolidada *por cliente*. Quando o síndico liga, a resposta é
*"deixa eu verificar e te retorno"* — o gestor não tem, numa tela só, o quadro do que está
pendente, do que já foi feito e do que está vinculado àquele condomínio.

**Evidência:** `docs/ESCOPO-MESTRE.md` (§ "⭐ Visão 360 do Cliente — *a tela que muda tudo*",
linhas ~313-320) marca isto como resposta direta à **dor L1** ("não tenho visão por cliente"), e
como item **não construído** (`- [ ]`). A investigação de git (commits, branches, PRs) confirma:
**nenhuma implementação existe** — nunca virou story, spec ou código até este documento.

## 2. Para quem
- **Supervisor / gestor de operação** — atende o síndico e decide o plano da semana; é quem hoje
  paga o custo de cruzar 4 fontes.
- **Colaborador (escritório)** — precisa do quadro do cliente para agendar e dar retorno.
- **Fabrício / Lucas (donos)** — querem que a empresa "responda na hora, com o quadro completo na
  frente" (imagem de empresa que tem controle).
- *(Fora do v1: o próprio síndico via Área do Cliente — E09, ainda não construído.)*

## 3. Escopo da v1 — o que dá pra construir HOJE

Princípio: **entregar valor real com o que já está no banco, sem prometer o que os módulos de base
ainda não sustentam.** A v1 é uma **página read-only de agregação por condomínio**, montada sobre
tabelas que já existem:

| Painel da v1 | Fonte de dados que JÁ existe | Observação de honestidade |
|---|---|---|
| **Cabeçalho / cadastro do cliente** | `pcm.clientes` (`nome`, `cnpj`, `ativo`, `auvo_id`) — migration `0001_E00-S00` | É **cadastro**, não "contrato". Termos de contrato (visitas/semana, horas/visita) **não existem** como colunas → fora do v1 (ver §4). |
| **Backlog GUT do cliente** | `pcm.ordens_servico` filtrado por `client_id`, OS abertas, ordenadas por `score_pcm desc` (coluna GENERATED, migration `0001_E00-S00`; lógica GUT = E01-S01, implementada) | O "backlog" e o "histórico" saem da **mesma tabela** `pcm.ordens_servico`; muda só o filtro de status. Índice `idx_os_score_desc` já existe. |
| **Histórico de OS do cliente** | `pcm.ordens_servico` filtrado por `client_id`, OS concluídas/canceladas, com status vindo do Auvo (webhook E01-S09/S10, mergeado) | Inclui o `status` sincronizado do campo (`auvo_sync_status`, `auvo_task_id`). |
| **Técnicos / equipamentos vinculados** *(condicional)* | `pcm.tecnicos_cache` e cache de equipamentos de **E01-S11** (cache read-only Auvo→PCM), vinculados via `pcm.clientes.auvo_id` | **Depende de E01-S11 estar mergeada.** Está sendo implementada em paralelo — se não estiver pronta na hora do @dev, este painel entra como *placeholder* e é ligado numa fase 2 curta, sem bloquear o resto da v1. |

**Regra de visibilidade (RBAC):** a Visão 360 respeita os grupos/permissões por módulo de
E00-S09/S10 e a matriz de papéis `superadmin / supervisor / colaborador` (E00-S08). *A qual módulo
a tela pertence, e quem enxerga qual cliente, é uma **decisão de produto em aberto** — ver §5.*

**O que o gestor consegue fazer na v1 que não conseguia:** abrir **uma** tela por condomínio e ver,
sem sair do sistema, o que está pendente (backlog priorizado) e o que já foi feito (histórico de OS)
— eliminando o cruzamento manual Auvo + planilha para essas duas perguntas.

## 4. Fora de escopo da v1 — explicitamente adiado

> **Vinculante.** Cada item abaixo está fora **porque o módulo que o sustenta ainda não foi
> construído** — não é decisão de produto de "não fazer", é **sequenciamento**. Cada um vira uma
> fase 2 quando o módulo correspondente existir.

- **Árvore de ativos / equipamentos com ficha técnica, hierarquia e prontuário** — depende da
  *Gestão de Ativos de verdade* (ESCOPO-MESTRE §"⭐ Gestão de Ativos", pedido explícito do
  Fabrício), **não construída**. Hoje só existe cache plano do Auvo (E01-S11), sem ficha/hierarquia/
  ciclo de vida. → Fase 2 quando o módulo de ativos existir.
- **Calendário preventivo / PMOC** — depende do sub-módulo PMOC (E01-S03 a E01-S08), todo
  *Planejado*, nada implementado. Confirmado pelo AC-7 deferido de E01-S10 (`pcm.pmoc_records` não
  existe). → Fase 2 quando o PMOC existir.
- **Situação financeira** — depende do módulo Financeiro (E04), status "Aguarda diagnóstico do mês
  1"; **não há tabelas financeiras** no schema. → Fase 2 quando E04 existir.
- **Linha do tempo de comunicação (WhatsApp)** — depende da integração Evolution API, **não
  implementada** (existe apenas o stub `atendimento.wa_messages`/`config_ze` do Agente Zé, sem
  ingestão real de mensagens). → Fase 2 quando a integração de comunicação existir.
- **Contrato com termos operacionais** (visitas/semana, visitas/mês, horas/visita) e o **indicador
  de saúde do contrato** (horas pendentes ÷ horas/semana) — as colunas **não existem** em
  `pcm.clientes`. → Fase 2 junto do cadastro de contrato.
- **Hierarquia `Administradora → Condomínio → Torre/Bloco`** — `pcm.clientes` é **plano** hoje. A
  v1 é "uma página por cliente/condomínio", sem visão de portfólio de administradora. → Fase 2.
- **Relatórios sob demanda / exportação** da tela — fora do v1 (só visualização).
- **Qualquer escrita** a partir da Visão 360 (editar OS, repriorizar, disparar ação) — v1 é
  **read-only**; ações ficam nas telas de origem (Hub de OS E01-S07, etc.).

## 5. Critérios de sucesso (negócio)

- **Métrica primária:** nº de perguntas "qual a situação do condomínio X?" respondidas **numa única
  tela**, sem o gestor abrir Auvo/planilha/WhatsApp em paralelo.
  - Baseline: 0 (hoje 100% exige cruzar ≥2 fontes externas).
  - Alvo v1: gestor responde "o que está pendente" e "o que já foi feito" de qualquer cliente
    cadastrado **só pela Visão 360**.
- **Métrica de confiança:** o backlog e o histórico exibidos batem com o estado real do
  `pcm.ordens_servico` (mesma fonte do Hub de OS) — sem divergência que force o gestor a reconferir
  no Auvo.
- **Métrica de percepção (qualitativa):** o gestor deixa de dizer *"deixa eu verificar e te
  retorno"* para as duas perguntas cobertas pela v1.

## 6. Perguntas em aberto (decisão do usuário — NÃO decididas por mim)

> São decisões de **produto/negócio**; a spec/escopo mestre é silenciosa sobre elas. Reportadas ao
> Lucas em vez de inventadas.

1. **[OPEN-QUESTION] Vale abrir a v1 agora, dado o volume de "fora de escopo"?** — 4 dos 8
   painéis descritos no escopo mestre dependem de módulos não construídos. A v1 entregaria
   cadastro + backlog + histórico (+ técnicos/equipamentos se E01-S11 fechar). *Opções:* (a) abrir
   a v1 enxuta agora e evoluir por fase; (b) esperar PMOC + Gestão de Ativos existirem para lançar
   uma versão "mais completa de uma vez". **Recomendação @pm:** (a) — a v1 já responde à dor L1 nas
   duas perguntas mais frequentes e cria o "esqueleto" da tela onde os painéis futuros encaixam;
   risco de (b) é a dor L1 seguir sem resposta por vários épicos.
2. **[OPEN-QUESTION] Onde a Visão 360 mora na navegação?** — *Opções:* (a) sub-tela dentro do
   módulo **PCM/Operação** (a partir do cliente/OS); (b) **módulo novo** de topo. Isso afeta o
   gating de E00-S09/S10 (a tela herda a permissão do módulo onde mora). **Recomendação @pm:** (a)
   sub-tela do PCM no v1 — reaproveita a permissão de módulo existente e evita criar um módulo cujo
   valor pleno só aparece nas fases 2.
3. **[OPEN-QUESTION] Quem enxerga a Visão 360 de qual cliente?** — *Opções:* (a) todo
   `colaborador` vê todos os clientes; (b) só `supervisor`+ ; (c) por grupo/permissão de módulo
   (E00-S09/S10), possivelmente restringindo colaborador aos clientes que atende. Envolve escopo de
   dado por papel — **não decido**; depende de como a Sinérgica quer expor a carteira internamente.

## 7. Riscos / premissas
- **Premissa:** E01-S11 (cache de técnicos/equipamentos) fecha em breve; se atrasar, o painel de
  técnicos/equipamentos entra depois — **não é bloqueante** para lançar cadastro + backlog +
  histórico.
- **Risco:** expectativa vs. entrega — o escopo mestre chama isto de "a tela que muda tudo" com 8
  painéis; a v1 entrega ~3. Alinhar com Lucas/Fabrício que a v1 é **fundação honesta**, não a tela
  completa (mitigação: §4 explícito + fases nomeadas).
- **Premissa:** read-only elimina risco de escrita/conflito de sync; a v1 lê a mesma fonte do Hub
  de OS, então não cria uma segunda "verdade".
- **Risco (dado por papel):** se a resposta da Q3 for "por grupo", a v1 precisa de RLS por cliente
  em `pcm.ordens_servico`/`pcm.clientes` — verificar com @architect se as policies atuais já
  suportam ou se exige migration (pode elevar o tier).

## 8. Rastreabilidade
- Origem do escopo: `docs/ESCOPO-MESTRE.md` §"⭐ Visão 360 do Cliente" (linhas ~313-320) e dor L1.
- Fontes de dados existentes: `supabase/migrations/0001_E00-S00_schemas_dominio.sql`
  (`pcm.clientes`, `pcm.ordens_servico` com `score_pcm` GENERATED); GUT em E01-S01
  (`specs/0001-priorizacao-backlog-gut/`); status de OS via Auvo em E01-S09/S10.
- Dependência de painel condicional: `specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md`.
- Dependências de fases futuras: PMOC (E01-S03–S08), Gestão de Ativos (ESCOPO-MESTRE §"⭐ Gestão de
  Ativos"), Financeiro (E04), integração Evolution/WhatsApp.
