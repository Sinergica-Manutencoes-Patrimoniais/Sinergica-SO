---
name: "docs-adr-0853-integridade-origem-calendario-retorno-md"
description: "Documento Sinérgica SO: ADR-0853 — Conferência da origem calendário no retorno"
alwaysApply: false
---

# ADR-0853 — Conferência da origem calendário no retorno

## Contexto

Na origem calendário, o classificador 0402 e o criador de Pendência associam OS à ocorrência e Rotina, mas não conferem o alvo do Plano preventivo legado contra a ocorrência e o snapshot histórico. Uma fixture sintética demonstrou aceitação de ocorrência de Grupo ligada a Plano legado de Sistema. Resultados anteriores dessa fixture comprovam controle transacional e permissões, não a validade da origem de negócio.

## Decisão

Preparar gate próprio desligado para exigir, nos dois consumidores da origem calendário, o resolvedor canônico de execução. Ele verifica vínculo exclusivo, Cliente, vencimento, alvo do Plano legado e identidade da Rotina no snapshot aprovado. As funções mantêm ACLs privadas e seus demais gates. Na classificação, exigir que origem resolvida corresponda à versão e Rotina consultadas; na Pendência, exigir também alvo da Rotina. A resolução não trata os campos de Sistema/Equipamento da OS como alvo exclusivo: eles podem ser contexto e seu significado completo ainda requer análise.

## Limites

O gate do resolvedor também precisa estar habilitado no futuro; se fechado, a nova guarda falha fechada. Grupo e Visita não são liberados por esta decisão. A verificação não serializa todas as mudanças de origem até commit, nem corrige dados legados, fotos, Auvo ou retorno histórico. Inventário dos escritores, concorrência, migração de dados e revisão adversarial são obrigatórios antes da ativação.
