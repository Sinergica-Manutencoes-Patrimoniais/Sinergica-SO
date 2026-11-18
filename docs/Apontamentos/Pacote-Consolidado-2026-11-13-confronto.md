---
name: confronto-pacote-consolidado-2026-11-13
description: Confronto item a item entre o Pacote Consolidado do Fabrício (v1.0, 13/11/2026) e o estado real do código.
---

# Confronto — Pacote Consolidado SSO v1.0 (13/11/2026) × código real

**Fonte funcional:** `docs/Apontamentos/Pacote-Consolidado-SSO-2026-11-13.txt` (texto extraído do
`.docx` original, versionado para que a regra aprovada pare de viver só no Downloads de alguém).
**Regra de precedência do próprio pacote:** quando ele divergir de documento, protótipo, tela ou
story antiga, **prevalece o pacote**. Anexos marcados "Em validação" **não autorizam implementação
definitiva**.

Este arquivo é diagnóstico, não decisão de produto. Cada veredito abaixo tem evidência concreta
(migration, arquivo, símbolo). Vereditos de **ausência** foram reconfirmados por um segundo comando
com critério diferente — regra que veio do erro registrado em `docs/STATE.md` (2026-11-11).

---

## 0. As duas respostas novas do Fabrício (mensagem de 17/11)

Elas **desbloqueiam `E01-S190`**, que estava parada esperando exatamente as perguntas 26 e 27.

| Pergunta | Resposta | Efeito |
|---|---|---|
| 26 — Assessment vira tipo de Inspeção? PMOC vira modalidade de Plano? | **Sim, com ajuste de nomenclatura e escopo.** Assessment deixa de existir como módulo; vira Inspeção do tipo **"Diagnóstico Inicial do Cliente"**, também aplicável à implantação inicial. PMOC vira **modalidade do Plano de Manutenção**, com campos, documentos, responsabilidades e exigências legais próprias; pode ter **visão filtrada**, mas **não** módulo nem cadastro independentes. | `E01-S190` AC-1/AC-2 ficam fechados em escopo e podem ser implementados. |
| 27 — Clientes, Sistemas e Componentes se reúnem em "Clientes e Estrutura"? | **Sim, na navegação e na experiência — não no modelo.** Entrada única "Clientes e Estrutura", jornada pela Visão 360, cadeia `Cliente → Áreas → Locais → Sistemas → Equipamentos → Componentes / Grupos quantitativos`, mais pesquisa global da estrutura. **Cliente, Local, Sistema, Equipamento, Componente e Grupo quantitativo continuam entidades diferentes, com regras e vínculos próprios — nada de tabela genérica única.** Sistemas e Componentes saem do menu principal mas continuam separados no modelo técnico. Auvo: Sistemas e equipamentos controlados podem ter vínculo; Componentes e Grupos quantitativos permanecem só no SSO. | `E01-S190` AC-4 fechado. **Restrição dura registrada:** a unificação é de menu e jornada; qualquer PR que funda tabelas de estrutura é SPEC_DEVIATION. |

A segunda resposta também antecipa a direção do anexo "Estrutura técnica" (que o próprio pacote
marca **Em validação**): Equipamento × Componente × Grupo quantitativo continuam distintos e a
sincronização com o Auvo é **restrita por tipo**. Isso não autoriza fechar o anexo — mas impede
que alguém "resolva" o conflito achatando os três num tipo só.

---

## 1. Backlog executável — veredito por item

Legenda: **Fechado** (existe e está provado) · **Parcial** (existe, mas diverge da regra aprovada
ou não está provado) · **Ausente** (não existe) · **Coberto por story aberta**.

### P0

| Item | Veredito | Evidência | O que falta |
|---|---|---|---|
| **BL 001** — Separar Chamado e OS (1:N) | **Fechado no banco** | `1842_E01-S167_transicao_1n_chamado_os.sql` remove o índice legado e troca a numeração para `pcm.sso_numero_os_chamado_compativel()`. Engenharia 1:N já existia e testada: `sso_criar_os_chamado` (0324), `sso_converter_chamado_integral` (1047), guarda de escritores (1499), `os_grupo_no_chamado` (1586). Devolução de escopo: 1830. Cancelamento forçado: 1832. | **Nada no domínio.** A divergência que resta é de **interface**: o Kanban de hoje é um quadro de **status de OS**, não de Chamado (ver BL 007). |
| **BL 002** — Corrigir o conceito de Backlog | **Parcial — divergência real** | Convivem dois Backlogs: (a) o legado, que é um **status da OS** — `pcm.ordens_servico.status='backlog'`, `STATUS_OS` em `apps/web/src/features/pcm/domain/ordens-servico.ts:127`, migration `0020_E01-S20_os_backlog_operacional.sql`; (b) o novo, `pcm.sso_backlog_parcelas` com `origem` (1218/1219/1830), que já é o conceito aprovado. A UI e o Kanban ainda consomem o legado. | Fazer o item de Backlog **anteceder** Chamado e OS; a seleção do PCM é que cria o Chamado e o manda para Demanda. Ver **E01-S193**. |
| **BL 003** — Visita como fonte oficial | **Parcial** | 108 migrations com `visita`; fundação em `0282_E01-S171_visitas_fundacao.sql`, equipe em 0285, US1+US2 da S171 com UI e testes verdes (`docs/STATE.md`, 2026-11-10). | Agenda por técnico ainda não comprovada como **projeção** da Visita — a evidência do Fabrício ("Agenda do Técnico sem alocações na mesma semana com dezenas de Chamados") é exatamente o sintoma. Já coberto por **E01-S192**. Sem story nova. |
| **BL 004** — Gatilho único em T−24 | **Fechado o acionador; gatilhos concorrentes continuam** | `1844_E01-S168_cron_despacho_t24.sql` + Edge Function `pcm-auvo-t24-despachar` criam o acionador que não existia ("a resposta para o que dispara a orquestração T−24 em produção era, literalmente, nada"). Quatro travas fechadas por padrão. | Continuam vivos os caminhos concorrentes `pcm-auvo-create-task` e `pcm-auvo-open-task`. O aprovado é **um gatilho normal** (confirmação PCM + T−24) e o manual como **contingência auditada**. Ver **E01-S196**. |
| **BL 005** — Autorização por capacidades sensíveis | **Parcial — fundação existe** | `0239_E01-S170_capacidades_sso.sql` cria `config.sso_acoes` (com `nivel` e `exige_concessao_individual`), `config.sso_perfis`, `config.sso_usuario_perfis`. Permissão por módulo em `0006_E00-S09`. | Falta a **matriz completa** das capacidades que o pacote nomeia (planejar, validar, aprovar, cancelar, exportar, ver valores internos, administrar) aplicada nas RPCs e propagada para API/Campo/MCP. Parcialmente coberto por **E01-S189** (grants faltantes); o resto vira **E00-S26**. |
| **BL 006** — Revogação imediata de acesso | **Ausente — confirmado** | `grep` por `jwt_version\|versao_sessao\|revogar_sessao\|sessao_revog` em `supabase/migrations`, `supabase/functions` e `apps/web/src`: **zero ocorrência**. Reconfirmado por caminho diferente: `supabase/functions/config-gerenciar-usuario/index.ts` só **lê** `ativo` para autorizar quem chama; não invalida nada. O hook de permissões (`0008_E00-S09_resolver_hook_permissoes.sql`) **carimba a permissão dentro do JWT** — logo, o token vigente preserva o poder revogado até expirar. | Mecanismo de versão/revogação de sessão e invalidação de cache. Ver **E00-S27**. **Risco de segurança aberto hoje.** |

### P1

| Item | Veredito | Evidência | O que falta |
|---|---|---|---|
| **BL 007** — Reorganizar o Kanban | **Divergência direta** | `apps/web/src/features/pcm/domain/kanban-colunas.ts`: `solicitacao · corretiva · backlog · preventiva · planejamento · em_execucao · finalizado · cancelado`. O aprovado é `Solicitações · Preventivas · Campo a conciliar · Demanda · Planejamento · Em execução · Validação PCM · Finalizado`, com **Backlog em painel lateral** e **Cancelado como filtro**. | Faltam três etapas (Campo a conciliar, Demanda, Validação PCM); sobram duas colunas (`corretiva`, `backlog`); `cancelado` precisa sair de coluna. Nota: a **mecânica** de Validação PCM já existe (`0560_E01-S168_validacao_pcm_resposta.sql`) — falta ser etapa visível. Ver **E01-S194**. |
| **BL 008** — Pendências técnicas por ativo | **Parcial** | 18 migrations de pendência (S173/S174/S183); filtro por ativo em `1097_E01-S173_filtro_ativo_paginado.sql`. | O aprovado é **agrupamento** por equipamento/Sistema preservando cada achado individual (o AC do Fabrício: 7 achados no mesmo quadro = 1 cartão com 7 pendências, PCM envia 2 ao Backlog, 5 conservam situação). Hoje há filtro, não agrupamento. Ver **E01-S197**. |
| **BL 009** — Deslocamento e capacidade | **Ausente o enquadramento** | `1357_E01-S172_declaracao_deslocamento.sql` guarda `minutos_por_pessoa`, `pessoas_proprias`, `motivo` — e **nada de origem, destino ou enquadramento**. `grep -rl "residenc\|enquadrament"` em migrations e `apps/web/src` só acerta arquivos de PMOC (sentido diferente). | Origem/destino (residência, escritório, Visita anterior/próxima, outro), regra residencial **não computa** × operacional **computa**, ocupação de jornada sem reduzir horas contratadas, excedente a validar sem classificar hora extra. Ver **E01-S195**. |
| **BL 010** — Materiais e Aquisições enxuto | **Fechado no domínio; disperso na navegação** | 49 migrations de material; os 7 estados da lista entraram em `1843_E01-S179_estados_faltantes_lista_materiais.sql` (SSO-013); custo de aquisição em 1255/1258. | O que falta é a **área única "Materiais e Aquisições" no PCM** — problema de navegação, resolvido junto com **E01-S190**. Sem story nova. |
| **BL 011** — Orçamento operacional opcional | **Fechado no domínio** | `0396_E01-S181_publicacao_orcamento_operacional.sql`, dispensa em 0437, visibilidade em `0576_E01-S183`, proteção de custo interno em `0231`/`0233_E01-S184`. | Conferir na homologação as duas regras numéricas do pacote: **fator 1,5 = preço 150% do custo (markup de 50%)** e tributos **configuráveis, não fixos no código**. Vira item de homologação, não story. |
| **BL 012** — Origem única dos faturáveis | **Fechado no schema** | `0343_E01-S182_fila_faturaveis.sql` linha 13: `unique(cliente_id, origem_tipo, origem_id)` — dupla cobrança da mesma origem é impossível por constraint. Imutabilidade de estorno em `1836`. | Nada de regra. Resta o gap de prova já conhecido: S182 tem 111 migrations e 3 arquivos pgTAP (`docs/STATE.md`). |
| **BL 013** — Navegação por função | **Coberto por story aberta** | — | **E01-S190**, agora desbloqueada pelas respostas 26/27. |

### P2

| Item | Veredito | Evidência | O que falta |
|---|---|---|---|
| **BL 014** — API de domínio sobre staging | **Parcial — staging existe, contrato não** | 27 migrations de staging (S169/S176/S177/S178): recepção (0315), conferência (0327), edição de linha (0474), fotos (0524/0541), documentos (0554/0561), aprovação de cronograma (0485). | Existe o **mecanismo** de staging; não existe a **API de domínio** autenticada e versionada que o Módulo de Campo e o MCP consumiriam — hoje são ~80 Edge Functions de propósito específico, não um contrato. Ver **E01-S198**. |
| **BL 015** — MCP controlado sobre a API | **Ausente** | Nenhuma Edge Function de MCP em `supabase/functions`. `E02-S30` existe só como design (2026-08-07). | Depende de BL 014 homologado. Ver **E02-S43**. |

---

## 2. Não implementar agora — por decisão do próprio pacote

Estes temas estão marcados **Em validação** ou **Próxima rodada**. O pacote é explícito: **não
autorizam implementação definitiva**. Ficam registrados para não serem "descobertos" de novo.

| Tema | Situação no pacote | Observação |
|---|---|---|
| Estrutura Técnica final (Equipamento × Componente × Grupo quantitativo) | Em validação | Grupos quantitativos já existem (`0248_E01-S176_grupos_quantitativos.sql`). A resposta 27 **restringe** o desenho (entidades distintas, Auvo por tipo) mas não fecha o anexo. |
| Relatórios e Área do Cliente | Em validação | Inclui planejamento diário no WhatsApp, relatório diário/fechamento de Visita, relatório mensal, laudos. **Não desenvolver o portal definitivo com base só neste caderno.** |
| Indicador de pressão do Backlog × capacidade (meses de cobertura) | Em validação (anexo) | Métrica proposta: `horas de demanda ativa ÷ capacidade mensal livre`. Destino: Cliente 360 e Cockpit. |
| Visão futura do síndico | Etapa própria | — |
| Solicitações por QR Code no condomínio | Anexo em validação | Módulo de triagem do condomínio; só o encaminhado chega à operação. |
| Cockpit e indicadores | Próxima rodada | O pacote diz explicitamente que **não bloqueia P0 e P1**. |
| Estoque completo | Obsoleto para a fase | Não implantar. |
| Técnico como usuário do SSO | Obsoleto nesta fase | Técnico executa pelo Auvo; **não** criar área do técnico no SSO. |

---

## 3. O que este confronto gerou

Stories novas (spec escrita nesta rodada):

| ID | Título | BL | Prioridade |
|---|---|---|---|
| E00-S26 | Capacidades sensíveis ponta a ponta (planejar, validar, aprovar, cancelar, exportar, ver custo, administrar) | BL 005 | P0 |
| E00-S27 | Revogação imediata de acesso — sessão, cache e JWT carimbado | BL 006 | P0 |
| E01-S193 | Backlog como escopo validado que antecede Chamado e OS | BL 002 | P0 |
| E01-S194 | Kanban operacional aprovado — Campo a conciliar, Demanda e Validação PCM como etapas | BL 007 | P1 |
| E01-S195 | Deslocamento: enquadramento residencial × operacional e impacto na jornada | BL 009 | P1 |
| E01-S196 | Gatilho único do Auvo — criação manual vira contingência auditada | BL 004 (resto) | P0 |
| E01-S197 | Pendências técnicas agrupadas por ativo, sem perder o achado individual | BL 008 | P1 |
| E01-S198 | API de domínio sobre o staging | BL 014 | P2 |
| E02-S43 | MCP controlado sobre a API de domínio | BL 015 | P2 |

Stories já abertas que o pacote confirma (sem story nova): **E01-S190** (desbloqueada),
**E01-S192** (Agenda/Preventivas), **E01-S189** (grants faltantes), **E01-S182** (pgTAP dos faturáveis).

Itens que o pacote fecha e **não** devem ser reimplementados: **BL 001** (1842), **BL 004 acionador**
(1844), **BL 010 estados de material** (1843), **BL 012 origem única** (0343).
