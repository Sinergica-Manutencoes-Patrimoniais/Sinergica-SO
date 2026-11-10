---
name: "docs-planejamento-plano-manutencao-programa-sso-terra-md"
description: "Documento Sinérgica SO: Programa SSO — pacote executável para Terra"
alwaysApply: false
---

# Programa SSO — pacote executável para Terra

**Data:** 2026-10-26 · **Estado:** especificação revisada; implementação não iniciada.
**Escopo:** todo o Caderno Técnico v1, SSO-001–021, CT-001–030, AUT-01–08 e respostas posteriores do Fabrício.
**Pacote:** 22 stories E01-S165–S186, 136 critérios de aceite, 377 tarefas abertas.

## Entrada e autoridade

1. Ler CLAUDE.md, AGENTS.md, constituição e somente linhas das stories ativas do ROADMAP.
2. Ler `Caderno_Tecnico_Implementacao_SSO_v1.docx` na raiz e [definições posteriores](definicoes-fabricio-caderno-v1.md).
3. Ler [contratos do programa](contratos-programa.md), ADR-0026/0027/0028 e matriz abaixo.
4. Selecionar uma story; ler spec/plan/research/data-model/contracts/quickstart/tasks/checklist. Definir `SPECIFY_FEATURE_DIRECTORY=specs/E01-SNNN-nome` exatamente conforme pasta; branch desta documentação não identifica automaticamente a story.

P01/P02/P03 fechadas. UI **Componentes e Sistemas** e cadastros/códigos atuais preservados. As naturezas técnicas equipamento/componente não exigem renomear menu ou duplicar tabela. Plano é amplo, Rotina tem alvo único; ocorrências nunca misturam alvos.

## Stories, reuso e dependências

| Story | Entrega | SSO | Depende de | AC | Tarefas |
|---|---|---|---|---:|---:|
| [E01-S165](../../../specs/E01-S165-plano-versoes-rotinas/spec.md) | Plano multialvo, versões de Rotina e questionários referenciados | SSO-006 | E01-S170, E01-S176 | 7 | 16 |
| [E01-S166](../../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md) | Calendário contratual, recorrência por modo e ocorrências idempotentes | SSO-005, SSO-006 | E01-S165, E01-S171 | 7 | 16 |
| [E01-S167](../../../specs/E01-S167-chamados-os-visitas/spec.md) | Chamado 1:N OS, continuidade e encerramento integral | SSO-001 | E01-S170 | 6 | 16 |
| [E01-S168](../../../specs/E01-S168-auvo-t24-validacao/spec.md) | Auvo T−24, serialização e validação PCM | SSO-003 | E01-S167, E01-S171, E01-S170 | 8 | 22 |
| [E01-S169](../../../specs/E01-S169-importacao-despesas-exportacao/spec.md) | Importação e exportação dos Planos Rimini e I Home | SSO-006, SSO-021 | E01-S165, E01-S166, E01-S178 | 6 | 16 |
| [E01-S170](../../../specs/E01-S170-governanca-plano/spec.md) | Permissões por ação e governança configurável do programa | SSO-019 | base existente | 6 | 16 |
| [E01-S171](../../../specs/E01-S171-visitas-operacionais/spec.md) | Visita operacional e associação histórica de OS | SSO-002 | E01-S167, E01-S170 | 6 | 16 |
| [E01-S172](../../../specs/E01-S172-agenda-capacidade-consolidada/spec.md) | Agenda oficial e capacidade por técnico, Cliente e semana | SSO-004 | E01-S171 | 6 | 16 |
| [E01-S173](../../../specs/E01-S173-pendencias-tecnicas/spec.md) | Pendências técnicas atômicas, resultados e agrupamento por ativo | SSO-007 | E01-S165, E01-S166, E01-S168 | 6 | 16 |
| [E01-S174](../../../specs/E01-S174-backlog-escopo-rastreavel/spec.md) | Backlog canônico e conversões de escopo sem perda | SSO-008 | E01-S173, E01-S167, E01-S170 | 6 | 16 |
| [E01-S175](../../../specs/E01-S175-origem-campo-auvo/spec.md) | OS de origem Auvo e triagem do Chamado provisório | SSO-009 | E01-S167, E01-S170 | 6 | 18 |
| [E01-S176](../../../specs/E01-S176-estrutura-tecnica-grupos/spec.md) | Hierarquia técnica, Sistemas distribuídos e Grupos Quantitativos | SSO-010 | E01-S170 | 6 | 16 |
| [E01-S177](../../../specs/E01-S177-codigos-publicos-alias/spec.md) | Código público protegido, aliases e política de Equipment Auvo | SSO-011 | E01-S176, E01-S170 | 6 | 16 |
| [E01-S178](../../../specs/E01-S178-levantamentos-staging-aprovacao/spec.md) | Levantamentos de planilha/Auvo e aprovação PCM em staging | SSO-012, SSO-021 | E01-S176, E01-S177, E01-S170 | 6 | 16 |
| [E01-S179](../../../specs/E01-S179-central-materiais-os/spec.md) | Central de Materiais, parser determinístico e exceções de campo | SSO-013, SSO-014 | E01-S167, E01-S171, E01-S170 | 6 | 16 |
| [E01-S180](../../../specs/E01-S180-despesas-visita/spec.md) | Despesas previstas/realizadas por Visita | SSO-016 | E01-S171, E01-S170 | 6 | 19 |
| [E01-S181](../../../specs/E01-S181-orcamentos-operacionais/spec.md) | Orçamento operacional canônico no Comercial | SSO-015 | E01-S179, E01-S170, E01-S184 | 6 | 19 |
| [E01-S182](../../../specs/E01-S182-faturaveis-origem/spec.md) | Fila A Faturar e efetivação por origem única | SSO-017 | E01-S180, E01-S181, E01-S167, E01-S171 | 6 | 19 |
| [E01-S183](../../../specs/E01-S183-portal-operacional/spec.md) | Portal de materiais, orçamento e cobrança | SSO-018 | E01-S179, E01-S181, E01-S182, E01-S184, E01-S170 | 6 | 19 |
| [E01-S184](../../../specs/E01-S184-protecao-custos-portal/spec.md) | Proteção imediata de custos no Portal e documentos | SSO-015, SSO-018, SSO-019 | base existente | 6 | 19 |
| [E01-S185](../../../specs/E01-S185-reconciliacao-integracoes/spec.md) | Reconciliação Auvo, Comercial e Financeiro | SSO-020 | E01-S168, E01-S175, E01-S181, E01-S182 | 6 | 18 |
| [E01-S186](../../../specs/E01-S186-migracao-pilotos-homologacao/spec.md) | Migração auditável, pilotos por ondas e homologação do programa | SSO-021 | E01-S165, E01-S166, E01-S167, E01-S168, E01-S169, E01-S170, E01-S171, E01-S172, E01-S173, E01-S174, E01-S175, E01-S176, E01-S177, E01-S178, E01-S179, E01-S180, E01-S181, E01-S182, E01-S183, E01-S184, E01-S185 | 6 | 16 |

Cada pasta contém oito artefatos: spec.md, plan.md, tasks.md, research.md, data-model.md, contracts/commands.md, quickstart.md e checklists/requirements.md. Contrato antigo auvo-task.md de S168 é redirecionamento. Os seis IDs anteriores foram mantidos; S167 agora se concentra em Chamado/OS, Visita vai para S171; S169 cuida de Plano/importação/exportação, despesas vão para S180. Nada disso é implementação concluída.

## Ordem recomendada

- **Proteção imediata independente:** S184 fecha exposição de custos em JSON, consultas diretas e PDF do Portal. S170 funda capacidades por ação e escopo.
- **Estrutura e identidade:** S176, S177 e S178 completam hierarquia/grupos, códigos/aliases e levantamentos aprovados. Guainumbí é piloto de estrutura.
- **Núcleo operacional:** S167, S171 e S172 entregam Chamado 1:N OS, Visita e agenda/capacidade. Essas fatias podem iniciar sobre estrutura existente, conforme dependências da tabela.
- **Preventivas e campo:** S165, S166, S168 e S175 entregam Plano/versões/Rotinas, calendário, T−24/retorno/validação e origem Auvo. S169 valida Rimini/I Home.
- **Triagem e aquisição:** S173, S174, S179, S180 e S181 entregam Pendências, Backlog, Materiais, despesas e orçamento.
- **Fechamento entre domínios:** S182, S183 e S185 conectam A Faturar, Portal e reconciliação.
- **Homologação de programa:** S186 fecha evidências e aceite por onda. Seus testes/fixtures podem ser preparados antes; sua conclusão requer as demais stories.

Uma ordem topológica válida: S184, S170, S176, S165, S167, S171, S166, S168, S177, S178, S169, S172, S173, S174, S175, S179, S180, S181, S182, S183, S185, S186. A tabela é autoritativa para dependências. Não impor execução paralela em migrations ou arquivos compartilhados.

## Sequência de pilotos do caderno

1. Guainumbí: estrutura/códigos/Local360/validação cadastral.
2. Guainumbí: Chamado/OS/Visita/agenda/T−24; CT-001–011.
3. Rimini e I Home: Planos, Rotinas, questionários e feriados.
4. Guainumbí: Pendências, Backlog e origem campo; CT-016–021.
5. Cliente escolhido: Materiais, aquisição e orçamento.
6. Cliente escolhido: A Faturar, Portal e permissões.

Preparar código/fixtures de dependências não significa ativar todas as ondas. Nenhum piloto foi executado neste pacote. Não prometer datas/esforço sem medir implementação.

## O que já existe e deve ser reaproveitado

- Cadastro e árvore: pcm.equipamentos, parent_item_id, sistemas/sistema_itens, catálogos/siglas e importação estrutural E01-S161.
- Preventivas E01-S53: cálculo ancorado, calendário/lista/timeline/drawers, questionários Auvo e gate de contrato.
- Chamados/OS e agenda: aplicação/adapters/read-models existentes; remover limites 1:1 somente por migração compatível e revisar também unique numérico/trigger 0151.
- Auvo: client, registry, assinatura, snapshots, webhook/polling, outbox e saúde. Não criar segundo motor.
- Comercial: propostas e versões/snapshots/precificação; orçamento operacional usa essa fonte. PCM orçamentos_servico fica legado compatível.
- Financeiro: recebíveis/documentos existentes; A Faturar integra por origem idempotente, não cria cobrança automática.
- Portal: shell, contatos, propostas, documentos e decisões, com projeção sanitizada e autorização atual.

O caderno descreve pai/filho como ausente; base já possui parent_item_id, faltam invariantes/fluxo completos. Trigger geral de envio ao planejar foi removido em 0168; centralizar também confirmação preventiva e abertura manual, sem assumir trigger ativo em produção.

## Limites e gates

**Fora da entrega atual:** aplicativo completo Copiloto Técnico/offline, novos módulos comercial/financeiro paralelos, recorrência nativa Auvo, sensores/IA preditiva, saneamento integral de todo histórico externo e inventar cadastro/tempo/norma a partir de planilha ou prosa.

**Dentro:** recepção estruturada do futuro Campo, tarefa provisória Auvo e importação em staging com aprovação PCM; tolerância normativa configurável com valor validado, sem presumir norma/tolerância universal.

**Gates técnicos:** criação/consulta/edição por OS, Equipment e questionário aplicáveis, timezone/HMAC/cancelamento Auvo, leitura segura de resposta e idempotência; permissões e compatibilidade financeira. Testar com doubles até prova controlada. Se contrato divergir, registrar SPEC_DEVIATION/ADR e manter automação desabilitada; não reabrir decisão funcional aprovada.

**DoD futuro:** testes focados e regressões, CI com db-tests não pulado, revisão adversarial arquitetural e evidência operacional por CT. `pnpm run eval:spec` atual seleciona apenas specs antigas; passar global não prova este pacote. Usar a validação documental explícita e ajustar seleção do gate durante execução se necessário.

Somente humano/@devops faz push/PR/deploy. Teste real Auvo e ampliação operacional exigem liberação Fabrício. Nenhuma task de implementação foi marcada concluída.

## Continuidade

[Guia de execução Terra](guia-execucao-terra.md) · [Matriz SSO/CT/AUT/RF](matriz-rastreabilidade.md) · [Validação documental](validacao-documental.md).
