# Validação planejada — E01-S168

Pré-requisitos: dependências concluídas, Postgres local, fixtures/doubles Auvo/Comercial/Financeiro e relógio controlado. Sem credencial real. Comandos são roteiro futuro, não comprovação de testes já existentes.

1. Executar testes de domínio/aplicação listados em tasks com `rtk pnpm exec vitest run apps/web/src/features/pcm/domain/auvo-elegibilidade.test.ts apps/web/src/features/pcm/application/validacao-os.test.ts`; todo AC deve ter evidência explícita.
2. Executar testes de Edge/shared listados em tasks com `rtk proxy deno test --allow-env --allow-read --allow-net=127.0.0.1,localhost supabase/functions/pcm-auvo-orquestrar/index.test.ts supabase/functions/_shared/auvo/contrato-operacional.test.ts supabase/functions/_shared/auvo/intencoes.test.ts supabase/functions/_shared/auvo/serializacao.test.ts supabase/functions/_shared/auvo/reconciliar-task.test.ts supabase/functions/pcm-auvo-webhook/index.test.ts`; transporte fake sem acesso ao fornecedor.
3. `rtk proxy supabase test db`: inclui `supabase/tests/E01-S168_integracao.test.sql`, sem pular negações de RLS/permissão.
4. Demonstrar Janela exata, confirmação dentro da janela, UTC versus Brasília, resposta tardia após cancelamento, task recebida antes de persistir ID, worker expirado, contrato suspenso após claim, questionário ausente em corretiva, conclusão antiga e PMOC repetido.
5. Registrar catálogo SSO-003; §§5.3, 6.5, 7 e 11; CT-003, CT-004, CT-005, CT-006, CT-028, CT-029, versão, ambiente, executor, data, IDs/correlação e resultado esperado/obtido. Revisão adversarial e CI com db-tests antes de PASS de implementação; gate externo permanece fechado até prova técnica e autorização operacional futura.

Nesta entrega apenas documentos: nenhum teste novo foi executado, API real chamada ou deploy realizado.
