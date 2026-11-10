# Validação planejada — E01-S175

Pré-requisitos: dependências concluídas, Postgres local, fixtures/doubles Auvo/Comercial/Financeiro e relógio controlado. Sem credencial real. Comandos são roteiro futuro, não comprovação de testes já existentes.

1. Executar testes de domínio/aplicação listados em tasks com `rtk pnpm exec vitest run apps/web/src/features/pcm/application/triagem-campo.test.ts`; todo AC deve ter evidência explícita.
2. Executar testes de Edge/shared listados em tasks com `rtk proxy deno test --allow-env --allow-read --allow-net=127.0.0.1,localhost supabase/functions/_shared/auvo/os-from-task.test.ts supabase/functions/_shared/auvo/origem-campo.test.ts supabase/functions/pcm-triagem-campo/index.test.ts supabase/functions/_shared/auvo/origem-campo-inbox.test.ts supabase/functions/_shared/auvo/levantamento-recepcao.test.ts`; transporte fake sem acesso ao fornecedor.
3. `rtk proxy supabase test db`: inclui `supabase/tests/E01-S175_integracao.test.sql`, sem pular negações de RLS/permissão.
4. Demonstrar Referência de outro Cliente, task externa que na verdade já possui OS SSO, referência inexistente, Cliente não sincronizado, chegada simultânea webhook/polling, união concorrente, tarefa concluída antes da ingestão, evento antigo após correção PCM, questionário desconhecido.
5. Registrar catálogo SSO-009; §6.4; CT-020, CT-021; definições Fabrício sobre Auvo provisório, versão, ambiente, executor, data, IDs/correlação e resultado esperado/obtido. Revisão adversarial e CI com db-tests antes de PASS de implementação; gate externo permanece fechado até prova técnica e autorização operacional futura.

Nesta entrega apenas documentos: nenhum teste novo foi executado, API real chamada ou deploy realizado.
