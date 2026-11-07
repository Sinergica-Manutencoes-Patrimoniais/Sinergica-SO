# Research — E01-S182

## Decision

Fila canônica no Financeiro e contrato compartilhado em packages; PCM publica elegibilidade, não escreve diretamente nas tabelas financeiras pelo navegador. Usar transação, request_id e unicidade da origem; alocação parcial sob lock. Reusar mecanismos de estorno e competência. Não inferir cobrança apenas de conclusão Auvo.

## Rationale

Operação produz candidatos faturáveis rastreáveis; Financeiro confere, efetiva e corrige por complemento/estorno, com unicidade por origem. Dependências: E01-S180, E01-S181, E01-S167 (encerramento/escopo) e E01-S171 (Visita). Fonte funcional: caderno SSO-017; respostas consolidadas do Fabrício prevalecem sobre rascunhos anteriores.

## Evidência de reuso

- `apps/web/src/features/financeiro/application/financeiro-gateway.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/financeiro/application/robustez.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/financeiro/application/fechamento.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0117_E04-S07_robustez_lancamentos.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0108_E04-S04_contratos_recebiveis.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.

## Alternatives considered

- Criar modelo paralelo completo: rejeitado por duplicar estado, decisão e origem.
- Corrigir só interface: rejeitado por permitir acesso/comando direto incompatível.
- Inferir ou completar legado automaticamente: rejeitado por alterar histórico sem decisão rastreável.

## Contratos técnicos e limites

Validar no ambiente local a forma real dos snapshots e grants atuais, mapa de IDs e efeito dos comandos; divergência precisa aparecer antes de executar migração. Nenhuma prova depende de API Auvo ou cobrança real nesta story. Documentação de desenho não equivale a homologação ou teste executado.

