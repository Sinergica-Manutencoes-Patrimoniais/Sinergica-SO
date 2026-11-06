# ADR-1109 — Acesso às funções de fontes de aquisição

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar concessão ao papel autenticado para declarar, listar e retificar fontes de aquisição, preparar composição mista e consultar sua fotografia. As funções mantêm os gates fechados e exigem capacidades e escopo do Cliente no servidor. Nenhum acesso direto às tabelas, envio de proposta ou cobrança é concedido.

## Limites

Concessão não ativa funcionalidade e não comprova exclusividade de gastos físicos. Antes do rollout, testar permissões e RLS/FORCE, concorrência, privacidade de custos, idempotência, fontes já utilizadas, caminhos antigos e revisão adversarial. Não aplicar enquanto houver lacunas bloqueantes.
