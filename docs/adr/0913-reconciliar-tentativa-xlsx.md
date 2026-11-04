# ADR-0913 — Reconciliação explícita de tentativa XLSX concorrente

Data: 2026-10-30 · Status: preparação, gate fechado.

Após resultado incerto, o cliente nunca troca automaticamente os identificadores. Uma ação explícita sob a mesma trava da origem poderá consultar o servidor e comparar o hash do arquivo selecionado com a tentativa local e o lote canônico. Se o servidor encontrar outro lote para a mesma origem e mesmo hash, a tentativa local passa a referenciar esse lote com um novo request do ator atual, preservando os identificadores anteriores localmente. Se o lote for o mesmo, manter o request. Ausência, origem legada, hash diferente, sessão negada ou alteração simultânea do armazenamento bloqueiam a troca.

A consulta serializa com a recepção canônica; unicidade de Cliente/origem é a garantia de que dois lotes não serão criados pela mesma origem. O comando servidor ainda valida matriz, bytes, ator e idempotência; hash igual não implica aceite ou execução. Alteração ou remoção privilegiada de origem e o protocolo de concorrência devem ser verificados antes do rollout. Não conectar à jornada operacional antes de testes de concorrência com Supabase real e revisão adversarial; rollback mantém a tentativa original sem enviar.
