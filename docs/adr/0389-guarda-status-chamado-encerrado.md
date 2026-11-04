# ADR-0389 — Guarda de status legado após encerramento conferido

Status: proposta, não homologada.

Inventário local identificou escrita direta de status em `supabase-chamados-adapter.ts` (conversão/backlog e cancelamento), integrações de OS/Chamado em `_shared/auvo/os-from-task.ts` e função legada de importação em 0151. O status legado usa `aberto`, `convertido_os`, `backlog`, `cancelado`; encerramento conferido usa marcador separado `sso_encerrado_em`. Status legado não é tratado como sinônimo de encerramento SSO.

Com gate de encerramento conferido habilitado, mudanças de status ou remoção do marcador em Chamado já encerrado são bloqueadas sem token privado de transação. Não interfere em chamados ainda abertos nem cria mecanismo automático de reabertura; uma reabertura explícita futura exige contrato e auditoria próprios. Gate desligado preserva comportamento legado. Escritores de OS e outros campos continuam sujeitos a revisão de concorrência; testes e revisão adversarial obrigatórios.
