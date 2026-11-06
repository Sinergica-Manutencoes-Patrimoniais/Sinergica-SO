# ADR-0915 — Composição protegida da borda XLSX

Data: 2026-10-30 · Status: preparação, não publicada.

A borda ainda não registrada compõe CORS restrito, autenticação Supabase, limite compartilhado por usuário e recepção atestada. Padrão fechado: somente habilitação explícita e configuração válida permitem escrita; falha de Auth ou limitador bloqueia antes da leitura do arquivo. O limitador usa serviço privilegiado exclusivamente para consumir o limite (10 solicitações por usuário por minuto), nunca para ler ou gravar o cronograma; o comando de negócio usa JWT do usuário e valida autorização novamente no banco. Chave de atestado permanece no servidor e deve corresponder ao Vault; nunca é devolvida ao cliente ou logs.

O handler não constitui registro, deploy ou liberação. Validar política de limite, origem CORS, autenticação, segredo, disponibilidade do worker no Edge Runtime e concorrência com Supabase real antes de publicação; gate e homologação continuam fechados. Rollback mantém handler não registrado e gates desligados.
