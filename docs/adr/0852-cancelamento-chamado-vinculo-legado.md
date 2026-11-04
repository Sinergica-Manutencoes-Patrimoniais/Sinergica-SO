# ADR 0852 — Cancelamento conservador e vínculo legado

O cancelamento conservador consultava apenas OS com `chamado_id`, ignorando uma OS apontada exclusivamente por `chamados.ordem_servico_id`. Isso poderia ocultar uma OS pendente ou inconsistência na decisão de cancelar.

A função privada passa a bloquear e conferir a união de vínculos diretos e unilateral legado, como no encerramento conferido, rejeitando vínculos inconsistentes. A regra de negócio, a auditoria e os gates existentes permanecem; nenhuma OS é modificada. A correção mantém a verificação de autorização durante o comando e exige READ COMMITTED para reavaliar vínculos depois dos bloqueios.

Rollback operacional: manter os gates fechados; reverter a função só após demonstrar que os consumidores e os dados não dependem da correção. A mudança não retira o índice singular nem libera 1:N. Rollout, testes integrados e revisão adversarial continuam bloqueados.

Limite conhecido: os triggers 1028 protegem Chamados encerrados, mas não impedem escritor legado de vincular uma OS depois de um cancelamento. Esta correção não resolve essa corrida nem autoriza habilitar o cancelamento; é necessário projetar e provar proteção compatível em ambas as ordens de concorrência antes do rollout.
