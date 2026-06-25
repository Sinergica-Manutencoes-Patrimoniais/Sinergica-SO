---
name: blueprint-comercial
description: Requirements do módulo Comercial (CRM, funil, propostas, contratos). Puxe ao planejar specs de captação ou proposta.
alwaysApply: false
---

# Blueprint — Comercial

> Schema Postgres: `comercial` · Feature: `apps/web/src/features/comercial/`

## Problema
Prospects e propostas eram geridos informalmente. Sem funil estruturado, a Sinérgica não conseguia
medir taxa de conversão, tempo de fechamento nem calcular o preço justo do contrato.

## Fluxos e regras de negócio

### Funil de CRM
Lead → Qualificado → Proposta enviada → Negociação → Fechado (ganho/perdido)

### Levantamento (Survey)
- Técnico ou comercial iniciam um levantamento técnico no condomínio prospecto.
- Chat técnico/IA coleta: sistemas existentes, área, equipamentos, problemas identificados.
- Checklist de disciplinas (estrutural, hidro, elétrico, SPDA, cobertura, fachada, etc.).
- LLM gera rascunho de proposta a partir do levantamento.

### Proposta
- Tipos: `servico_pontual` (valor único) ou `contrato_mensal` (recorrente).
- Conteúdo gerado por LLM: escopo, atividades, materiais estimados, MO, totais.
- Revisão automática: LLM valida consistência (escopo × valores × materiais).
- Versionamento: cada alteração gera nova versão snapshot.
- Exportação: DOCX formatado para envio ao cliente.

### Precificação de Contrato Mensal (Volante)
- Tabela fixa de preços por (n_tecnicos × visitas_por_semana).
- Estrutura de custo: salário + encargos + benefícios + veículo + overhead + margem.
- Markup de materiais configurável por proposta.

### Status de Proposta
`rascunho` → `em_revisao` → `aprovada` → `enviada` → `aceita` | `recusada` | `cancelada`

## Entidades
| Entidade | Descrição |
|----------|-----------|
| `Lead` | Condomínio prospecto (antes de virar cliente) |
| `Proposta` | Documento com escopo, materiais, MO e valor |
| `PropostaVersao` | Snapshot de cada alteração |
| `Survey` | Levantamento de campo (chat IA + checklist) |
| `CatalogoMateriais` | Preços de referência + markup por material |

## Métricas
| Métrica | Definição |
|---------|-----------|
| Taxa de conversão | Propostas aceitas / enviadas |
| Tempo médio de fechamento | Lead → contrato assinado |
| Valor médio de contrato | MRR por contrato mensal |
