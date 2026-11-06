# ADR-0614 — Fronteira bloqueada de criação de OS para Grupo

A prévia autorizada identifica intenção, ocorrência, versão, Rotina e Grupo históricos e sinaliza decisão ou vínculo declarado. O comando de criação é deliberadamente fail-closed e sempre falha, mesmo com gate habilitado; não possui INSERT ou chamada externa. Nenhum gate ou permissão é ativado.

Não se comprovou a segurança de gatilhos e consumidores de OS para origem Grupo, nem serialização e efeitos externos. Esta migration não implementa criação de OS, execução ou integração de fila; não pode ser considerada entrega funcional. Uma implementação futura exige contrato canônico, revisão de segurança, testes e homologação.
