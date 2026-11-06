# Research — E01-S180

## Decision

Criar agregado oficial aditivo; manter pcm.despesas como espelho histórico Auvo. Conferir vínculo com Financeiro via contrato/RPC e chave de origem, sem importar feature Financeiro no PCM. Anexos em bucket privado com policies por Cliente e permissão de despesas.

## Rationale

PCM registra despesas previstas e realizadas na Visita; rateio por OS é opcional e não multiplica despesa nem cobrança. Dependências: E01-S171 (Visita) e E01-S170 (autorização). Fonte funcional: caderno SSO-016; respostas consolidadas do Fabrício prevalecem sobre rascunhos anteriores.

## Evidência de reuso

- `supabase/migrations/0079_E01-S54_despesas_auvo.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/financeiro/application/financeiro-gateway.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/financeiro/application/robustez.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.

## Alternatives considered

- Criar modelo paralelo completo: rejeitado por duplicar estado, decisão e origem.
- Corrigir só interface: rejeitado por permitir acesso/comando direto incompatível.
- Inferir ou completar legado automaticamente: rejeitado por alterar histórico sem decisão rastreável.

## Contratos técnicos e limites

Validar no ambiente local a forma real dos snapshots e grants atuais, mapa de IDs e efeito dos comandos; divergência precisa aparecer antes de executar migração. Nenhuma prova depende de API Auvo ou cobrança real nesta story. Documentação de desenho não equivale a homologação ou teste executado.

