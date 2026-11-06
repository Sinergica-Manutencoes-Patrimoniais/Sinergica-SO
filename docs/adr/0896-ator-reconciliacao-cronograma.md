# ADR-0896 — Vincular pedido de reconciliação ao ator

Data: 2026-10-30 · Status: preparação, gate fechado, não homologado.

A tentativa de reconciliação pode ser preparada sob uma sessão e enviada depois de uma troca de usuário. Mesmo que ambos tenham permissão, o pedido não deve executar sob outra identidade.

Preparar entrada aditiva com ator esperado no pedido e conferir igualdade com `auth.uid()` antes de delegar à mediação já autorizada. O ator esperado não concede permissão: as verificações existentes de Cliente, capacidades, gate e revisão continuam obrigatórias. Retirar EXECUTE da entrada anterior para evitar contorno. A tentativa armazenada pelo cliente também inclui ator e é recuperada apenas no mesmo contexto.

Banco e consumidor exigem implantação coordenada após testes de sessão, concorrência, permissão e revisão adversarial. Em reversão, fechar gate antes de trocar consumidor. Não migrar dados ou abrir gate nesta etapa.
