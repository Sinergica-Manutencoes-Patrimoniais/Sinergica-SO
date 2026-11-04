# ADR-0350 — Retirada e republicação de orçamento público

Status: proposta; gate fechado, revisão e testes pendentes.

O Comercial pode retirar ou republicar a versão pública atual ainda enviada, usando eventos auditados; republicação apresenta o mesmo snapshot imutável, sem alterar preço ou itens. Nenhuma decisão do Cliente é apagada, e após aceite ou recusa este comando não altera visibilidade: correções posteriores exigem processo próprio. Enquanto o gate estiver ativo, consultas públicas, histórico, PDF e decisão do Cliente excluem versão retirada, sem recorrer a outra versão. A autorização e versão são revalidadas no servidor. Exige revisão de canais legados, cache, concorrência e segurança antes de ativação.
