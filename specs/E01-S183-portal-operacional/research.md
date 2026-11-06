# Research — E01-S183

## Decision

Reusar supabase-portal-adapter e portal-gateway, expandindo DTO público via packages e views/RPCs. Refatorar leituras tocadas para TanStack Query, query keys por Conta e identidade; revogação server-side por membership vigente. Segurança do payload/PDF é pré-requisito E01-S184.

## Rationale

Cliente acompanha materiais, responsabilidade, orçamento/decisão, OS e cobrança pelo mesmo contexto com isolamento e dados públicos. Dependências: E01-S179, E01-S181, E01-S182, E01-S184 e E01-S170. Fonte funcional: caderno SSO-018; respostas consolidadas do Fabrício prevalecem sobre rascunhos anteriores.

## Evidência de reuso

- `apps/web/src/features/area-cliente/application/portal-gateway.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0202_E03-S12_view_portal_orcamentos.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0145_E09-S10_portal_financeiro.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.

## Alternatives considered

- Criar modelo paralelo completo: rejeitado por duplicar estado, decisão e origem.
- Corrigir só interface: rejeitado por permitir acesso/comando direto incompatível.
- Inferir ou completar legado automaticamente: rejeitado por alterar histórico sem decisão rastreável.

## Contratos técnicos e limites

Validar no ambiente local a forma real dos snapshots e grants atuais, mapa de IDs e efeito dos comandos; divergência precisa aparecer antes de executar migração. Nenhuma prova depende de API Auvo ou cobrança real nesta story. Documentação de desenho não equivale a homologação ou teste executado.

