# Research — E01-S184

## Decision

Bug comprovado: 0188 entrega v.payload inteiro; proposta-pdf.ts usa custo_unitario_centavos. 0202 usa security_invoker mas 0144 permite cliente consultar tabela com itens JSON livre. Corrigir ambos os percursos via migrations aditivas alterando view/RPC e grants/policies; manter interno via leitura autorizada. Como independente de E01-S170, correção inicial restringe custos ao administrador existente; posterior matriz granular amplia somente com autorização. PDF público recebe contrato seguro de packages, sem import de feature Comercial pelo Portal.

## Rationale

Remover composição interna de todos os caminhos acessíveis ao Cliente e separar documento público do snapshot privado preservado. Dependências: Independente; correção crítica prévia à E01-S181/E01-S183. Fonte funcional: caderno SSO-015, SSO-018 e SSO-019; respostas consolidadas do Fabrício prevalecem sobre rascunhos anteriores.

## Evidência de reuso

- `supabase/migrations/0188_E03-S06_portal_propostas.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0202_E03-S12_view_portal_orcamentos.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `supabase/migrations/0144_E09-S09_portal_orcamentos.sql`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/comercial/domain/proposta-pdf.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/comercial/domain/proposta-pdf.test.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.
- `apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts`: inspecionado como base; evoluir em migration/arquivo novo ou alteração focal, sem reescrever migration aplicada.

## Alternatives considered

- Criar modelo paralelo completo: rejeitado por duplicar estado, decisão e origem.
- Corrigir só interface: rejeitado por permitir acesso/comando direto incompatível.
- Inferir ou completar legado automaticamente: rejeitado por alterar histórico sem decisão rastreável.

## Contratos técnicos e limites

Validar no ambiente local a forma real dos snapshots e grants atuais, mapa de IDs e efeito dos comandos; divergência precisa aparecer antes de executar migração. Nenhuma prova depende de API Auvo ou cobrança real nesta story. Documentação de desenho não equivale a homologação ou teste executado.

