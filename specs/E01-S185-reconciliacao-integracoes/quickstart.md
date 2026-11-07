# Validação planejada — E01-S185

Pré-requisitos: dependências concluídas, Postgres local, fixtures/doubles Auvo/Comercial/Financeiro e relógio controlado. Sem credencial real. Comandos são roteiro futuro, não comprovação de testes já existentes.

1. Executar testes de domínio/aplicação listados em tasks com `rtk pnpm exec vitest run apps/web/src/features/pcm/application/reconciliacao.test.ts`; todo AC deve ter evidência explícita.
2. Executar testes de Edge/shared listados em tasks com `rtk proxy deno test --allow-env --allow-read --allow-net=127.0.0.1,localhost supabase/functions/_shared/integracoes/projecao.test.ts supabase/functions/integracoes-reconciliar/index.test.ts supabase/functions/_shared/integracoes/reconciliar.test.ts supabase/functions/_shared/integracoes/conflitos.test.ts supabase/functions/integracoes-verificar/index.test.ts`; transporte fake sem acesso ao fornecedor.
3. `rtk proxy supabase test db`: inclui `supabase/tests/E01-S185_integracao.test.sql`, sem pular negações de RLS/permissão.
4. Demonstrar 4xx permanente, 429/5xx, timeout após POST, dois operadores, callback tardio após resolução, lease órfão, webhook perdido, divergência financeira e acesso cruzado entre Clientes.
5. Registrar catálogo SSO-020; CT-005, CT-028, CT-029; integrações Auvo, Comercial e Financeiro, versão, ambiente, executor, data, IDs/correlação e resultado esperado/obtido. Revisão adversarial e CI com db-tests antes de PASS de implementação; gate externo permanece fechado até prova técnica e autorização operacional futura.

Nesta entrega apenas documentos: nenhum teste novo foi executado, API real chamada ou deploy realizado.
