---
name: "docs-planejamento-plano-manutencao-matriz-rastreabilidade-md"
description: "Documento Sinérgica SO: Matriz de rastreabilidade — Caderno SSO"
alwaysApply: false
---

# Matriz de rastreabilidade — Caderno SSO

Todos os vínculos abaixo são **planejamento de cobertura**, não testes já aprovados. Cada story liga AC a tasks de teste e regra. S186 apenas coordena homologação; não substitui testes de domínio das proprietárias.

## SSO-001–021

| Requisito fonte | Comportamento | Stories proprietárias |
|---|---|---|
| SSO-001 | Separar Chamado/OS | [E01-S167](../../../specs/E01-S167-chamados-os-visitas/spec.md) |
| SSO-002 | Visita operacional | [E01-S171](../../../specs/E01-S171-visitas-operacionais/spec.md) |
| SSO-003 | T−24 idempotente | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) |
| SSO-004 | Agenda/capacidade | [E01-S172](../../../specs/E01-S172-agenda-capacidade-consolidada/spec.md) |
| SSO-005 | Calendário contratual/feriados | [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md) |
| SSO-006 | Plano/versionamento | [E01-S165](../../../specs/E01-S165-plano-versoes-rotinas/spec.md), [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md), [E01-S169](../../../specs/E01-S169-importacao-despesas-exportacao/spec.md) |
| SSO-007 | Pendências por ativo | [E01-S173](../../../specs/E01-S173-pendencias-tecnicas/spec.md) |
| SSO-008 | Pendência/Backlog/Chamado/OS | [E01-S174](../../../specs/E01-S174-backlog-escopo-rastreavel/spec.md), [E01-S167](../../../specs/E01-S167-chamados-os-visitas/spec.md) |
| SSO-009 | Origem de campo Auvo | [E01-S175](../../../specs/E01-S175-origem-campo-auvo/spec.md) |
| SSO-010 | Hierarquia técnica | [E01-S176](../../../specs/E01-S176-estrutura-tecnica-grupos/spec.md) |
| SSO-011 | Códigos/TAG/Auvo | [E01-S177](../../../specs/E01-S177-codigos-publicos-alias/spec.md) |
| SSO-012 | Cadastro progressivo/PCM | [E01-S178](../../../specs/E01-S178-levantamentos-staging-aprovacao/spec.md) |
| SSO-013 | Central de Materiais | [E01-S179](../../../specs/E01-S179-central-materiais-os/spec.md) |
| SSO-014 | Parser sem IA | [E01-S179](../../../specs/E01-S179-central-materiais-os/spec.md) |
| SSO-015 | Aquisição/preço/orçamento | [E01-S181](../../../specs/E01-S181-orcamentos-operacionais/spec.md), [E01-S184](../../../specs/E01-S184-protecao-custos-portal/spec.md) |
| SSO-016 | Despesas por Visita | [E01-S180](../../../specs/E01-S180-despesas-visita/spec.md) |
| SSO-017 | A Faturar | [E01-S182](../../../specs/E01-S182-faturaveis-origem/spec.md) |
| SSO-018 | Portal | [E01-S183](../../../specs/E01-S183-portal-operacional/spec.md), [E01-S184](../../../specs/E01-S184-protecao-custos-portal/spec.md) |
| SSO-019 | Perfis/permissões | [E01-S170](../../../specs/E01-S170-governanca-plano/spec.md), [E01-S184](../../../specs/E01-S184-protecao-custos-portal/spec.md) |
| SSO-020 | Reconciliação | [E01-S185](../../../specs/E01-S185-reconciliacao-integracoes/spec.md) |
| SSO-021 | Migração/pilotos | [E01-S178](../../../specs/E01-S178-levantamentos-staging-aprovacao/spec.md), [E01-S169](../../../specs/E01-S169-importacao-despesas-exportacao/spec.md), [E01-S186](../../../specs/E01-S186-migracao-pilotos-homologacao/spec.md) |

## CT-001–030

| Teste fonte | Owner de regra | AC locais | Demonstração |
|---|---|---|---|
| CT-001 | [E01-S167](../../../specs/E01-S167-chamados-os-visitas/spec.md) | AC-1, AC-2, AC-3 | Um Chamado, três OS; encerrar duas mantém contêiner aberto |
| CT-002 | [E01-S167](../../../specs/E01-S167-chamados-os-visitas/spec.md) | AC-4, AC-5 | Parcial preserva horas e continuação recebe restante |
| CT-003 | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | AC-1, AC-2 | Confirmar sete dias antes; nenhum envio antes da janela |
| CT-004 | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | AC-1, AC-2 | Confirmar dentro de 24 h; tarefa por OS elegível |
| CT-005 | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | AC-4, AC-5, AC-6 | Três reexecuções/envios concorrentes; mesmos IDs |
| CT-006 | [E01-S171](../../../specs/E01-S171-visitas-operacionais/spec.md) | AC-4, AC-5 | Reprogramar associação e preservar tarefa; S168 executa atualização |
| CT-007 | [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md) | AC-1 | Feriado por Visita sem Visita/ocorrência/capacidade |
| CT-008 | [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md) | AC-2, AC-4, AC-7 | Rotina legal/calendário permanece pendente; âncora/tolerância |
| CT-009 | [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md) | AC-3, AC-8 | Novo dia contratual só com vigência futura; grande volume usa fotografia paginada e confirmação atômica |
| CT-010 | [E01-S171](../../../specs/E01-S171-visitas-operacionais/spec.md) | AC-6 | Extra e regular coexistem sem mudar regra semanal |
| CT-011 | [E01-S172](../../../specs/E01-S172-agenda-capacidade-consolidada/spec.md) | AC-4, AC-5, AC-6 | 10h em 8 h alerta confirmável; composição também verificada |
| CT-012 | [E01-S176](../../../specs/E01-S176-estrutura-tecnica-grupos/spec.md) | AC-1, AC-4, AC-5, AC-6 | Sistema distribuído em vários Locais, dois eixos |
| CT-013 | [E01-S176](../../../specs/E01-S176-estrutura-tecnica-grupos/spec.md) | AC-2 | VRF sem ciclo, vínculo cruzado e com histórico |
| CT-014 | [E01-S176](../../../specs/E01-S176-estrutura-tecnica-grupos/spec.md) | AC-3 | 20 luminárias em Grupo por Local sem 20 TAGs |
| CT-015 | [E01-S177](../../../specs/E01-S177-codigos-publicos-alias/spec.md) | AC-1, AC-2, AC-3, AC-4, AC-5 | Identidade protegida; alias excepcional pesquisável |
| CT-016 | [E01-S173](../../../specs/E01-S173-pendencias-tecnicas/spec.md) | AC-1, AC-3 | Três Não OK mantêm preventiva executada e três Pendências |
| CT-017 | [E01-S173](../../../specs/E01-S173-pendencias-tecnicas/spec.md) | AC-2 | Corrigido guarda evidência e não abre Pendência |
| CT-018 | [E01-S173](../../../specs/E01-S173-pendencias-tecnicas/spec.md) | AC-4, AC-5 | Promover duas de sete; S174 compõe e preserva fontes |
| CT-019 | [E01-S174](../../../specs/E01-S174-backlog-escopo-rastreavel/spec.md) | AC-4, AC-5, AC-6 | Devolver somente não resolvido ao Backlog |
| CT-020 | [E01-S175](../../../specs/E01-S175-origem-campo-auvo/spec.md) | AC-1 | Task com ID válido liga Chamado correto |
| CT-021 | [E01-S175](../../../specs/E01-S175-origem-campo-auvo/spec.md) | AC-2, AC-3, AC-4, AC-5 | Sem ID válido: OS/provisório únicos e triagem |
| CT-022 | [E01-S179](../../../specs/E01-S179-central-materiais-os/spec.md) | AC-1, AC-2, AC-3 | Bullets e prosa preservada, revisão juntar/dividir |
| CT-023 | [E01-S179](../../../specs/E01-S179-central-materiais-os/spec.md) | AC-4, AC-5 | Material faltante reabre exceção na mesma OS |
| CT-024 | [E01-S184](../../../specs/E01-S184-protecao-custos-portal/spec.md) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | Custo privado ausente em JSON/PDF/legado/anexo; preço em S181 |
| CT-025 | [E01-S181](../../../specs/E01-S181-orcamentos-operacionais/spec.md) | AC-3, AC-4 | Dispensa registrada sem zerar valor; versões congeladas |
| CT-026 | [E01-S182](../../../specs/E01-S182-faturaveis-origem/spec.md) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | Origem única, parcial/complemento/estorno explícitos |
| CT-027 | [E01-S183](../../../specs/E01-S183-portal-operacional/spec.md) | AC-5, AC-6 | Isolamento A/B e revogação, combinado S170/S184 |
| CT-028 | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | AC-7 | Evento antigo não regride execução; S185 reconcilia |
| CT-029 | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | AC-5, AC-6 | Timeout incerto reconcilia antes de POST; S185 expõe |
| CT-030 | [E01-S186](../../../specs/E01-S186-migracao-pilotos-homologacao/spec.md) | AC-1, AC-2, AC-3 | Lote repetido sem diferença e reversão lógica controlada |

Toda execução CT registra versão, ambiente, executor, data, IDs, resultado, capturas/logs seguros e ressalva. Recepção padronizada de levantamentos, aliases, tolerâncias zero/normativas, revogação e aprovação parcial também têm AC próprios em S166/S177/S178/S170, além dos CT originais.

## AUT-01–08

| Automação | Owner | Identidade e proteção |
|---|---|---|
| AUT-01 | [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md) | Rotina lógica + alvo + ciclo, independente da revisão; janela 30 dias |
| AUT-02 | [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md), [E01-S171](../../../specs/E01-S171-visitas-operacionais/spec.md) | contrato + ocorrência contratual válida; feriado não cria cartão |
| AUT-03 | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | osId + revisão de programação, confirmação válida e T−24 |
| AUT-04 | [E01-S171](../../../specs/E01-S171-visitas-operacionais/spec.md), [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | osId/taskId mantidos, associação histórica e fencing |
| AUT-05 | [E01-S175](../../../specs/E01-S175-origem-campo-auvo/spec.md) | taskId único no inbox/OS e provisório quando aplicável |
| AUT-06 | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | eventId/revisão confiável; campo não encerra Chamado |
| AUT-07 | [E01-S173](../../../specs/E01-S173-pendencias-tecnicas/spec.md) | avaliação + pergunta + ativo, Não OK explícito; Corrigido sem aberta |
| AUT-08 | [E01-S182](../../../specs/E01-S182-faturaveis-origem/spec.md) | origem tipo/id + complemento distinto + requestId |

## RF01–RF32 da especificação anterior

As definições posteriores prevalecem em alvo amplo de Plano e feriado por modo. Preservar intenção dos demais RF.

| RF | Cobertura |
|---|---|
| RF01, RF02, RF03, RF04 | [E01-S165](../../../specs/E01-S165-plano-versoes-rotinas/spec.md), [E01-S176](../../../specs/E01-S176-estrutura-tecnica-grupos/spec.md), [E01-S177](../../../specs/E01-S177-codigos-publicos-alias/spec.md) — alvo único da Rotina, identidade e tempos |
| RF05, RF06, RF07 | [E01-S165](../../../specs/E01-S165-plano-versoes-rotinas/spec.md), [E01-S169](../../../specs/E01-S169-importacao-despesas-exportacao/spec.md), [E01-S178](../../../specs/E01-S178-levantamentos-staging-aprovacao/spec.md) — criação/modelo por cópia, pendências/erros |
| RF08, RF09, RF10, RF11, RF12, RF13 | [E01-S165](../../../specs/E01-S165-plano-versoes-rotinas/spec.md), [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md) — unidades/âncora, modo, prévia,30d e unicidade |
| RF14, RF15, RF16 | [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md), [E01-S167](../../../specs/E01-S167-chamados-os-visitas/spec.md), [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) — fila própria, cancelamento, validação |
| RF17, RF18, RF19, RF20, RF21, RF22 | [E01-S172](../../../specs/E01-S172-agenda-capacidade-consolidada/spec.md), [E01-S165](../../../specs/E01-S165-plano-versoes-rotinas/spec.md), [E01-S171](../../../specs/E01-S171-visitas-operacionais/spec.md) — HH, disponibilidade, baseline e equipe |
| RF23, RF24, RF25, RF26 | [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md), [E01-S175](../../../specs/E01-S175-origem-campo-auvo/spec.md), [E01-S177](../../../specs/E01-S177-codigos-publicos-alias/spec.md), [E01-S185](../../../specs/E01-S185-reconciliacao-integracoes/spec.md) — contrato, T−24, retry e retorno |
| RF27 | [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md), [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) — origem única PMOC/Plano por rotina |
| RF28, RF29, RF30 | [E01-S165](../../../specs/E01-S165-plano-versoes-rotinas/spec.md), [E01-S170](../../../specs/E01-S170-governanca-plano/spec.md) — estados/versões/gestão e retomada |
| RF31, RF32 | [E01-S169](../../../specs/E01-S169-importacao-despesas-exportacao/spec.md), [E01-S178](../../../specs/E01-S178-levantamentos-staging-aprovacao/spec.md) — importação aprovada idempotente e PDF/planilha |

## Telas do caderno §9

Cliente360: S165/S169/S171/S173/S174/S179/S182. Local360/Sistema360/Ativo360: S176/S177/S178. Preventivas: S165/S166/S168. Pendências: S173. Backlog/Kanban/Chamado: S174/S167. OS: S167/S168/S179/S180. Agenda: S171/S172. Central Materiais: S179. Orçamentos: S181. A Faturar: S182. Reconciliação: S185. Portal e segurança: S183/S184/S170. Nenhuma tela cria nova regra paralela ao gateway proprietário.

## Substituições explícitas

- Plano de alvo exclusivo nas fontes antigas: substituído pelo Plano amplo com alvo específico em cada Rotina.
- Supressão indiscriminada em feriado: substituída por supressão só por Visita, obrigação preservada por calendário.
- Restringir criação provisória de Chamado de campo: substituído por S175 conforme caderno §6.4.
- Materiais emergenciais como despesa: material agora é aquisição/fornecimento; despesa de atendimento em S180, sem dupla apropriação.
- E01-S165–S170 iniciais: revisadas nestas mesmas pastas, sem IDs duplicados.
