# Research — E01-S181

## Decision

Comercial é canônico porque já oferece composição, snapshots e decisões. Adaptar oportunidade_id obrigatório com origem operacional explícita em migration aditiva e regra XOR validada, mantendo propostas comerciais existentes. Não usar financeiro.orcamentos nem terceira tabela de orçamento PCM. Criar API pública sanitizada conforme E01-S184. Compatibilidade com portal_decidir_orcamento deve impedir OS duplicada.

## Rationale

Reutilizar propostas/versões do Comercial para fornecimento e serviço operacional, vincular OS/lista e preservar compatibilidade com orçamentos legados do PCM. Dependências: E01-S179 (materiais), E01-S170 (autorização) e E01-S184 (proteção de custos). Fonte funcional: caderno SSO-015; respostas consolidadas do Fabrício prevalecem sobre rascunhos anteriores.

## Evidência de reuso

- `supabase/migrations/0182_E03-S04_propostas.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0184_E03-S04_rpcs_proposta.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0144_E09-S09_portal_orcamentos.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0125_E04-S12_dre_orcamento.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/comercial/application/proposta.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/comercial/infrastructure/supabase-proposta-adapter.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.

## Alternatives considered

- Criar modelo paralelo completo: rejeitado por duplicar estado, decisão e origem.
- Corrigir só interface: rejeitado por permitir acesso/comando direto incompatível.
- Inferir ou completar legado automaticamente: rejeitado por alterar histórico sem decisão rastreável.

## Contratos técnicos e limites

Validar no ambiente local a forma real dos snapshots e grants atuais, mapa de IDs e efeito dos comandos; divergência precisa aparecer antes de executar migração. Nenhuma prova depende de API Auvo ou cobrança real nesta story. Documentação de desenho não equivale a homologação ou teste executado.

