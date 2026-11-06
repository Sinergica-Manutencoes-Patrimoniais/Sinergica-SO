# ADR-0705 — Acesso à reconciliação do próprio pedido de OS

Status: preparada; não aplicada nem homologada.

Concede-se a `authenticated` somente execução da consulta de 0929. A função mantém gate próprio desligado, autorização atual por Cliente, ator original e identidade completa do pedido. Não concede acesso às tabelas ou ao comando de criação, nem modifica as restrições legadas. `anon` e `service_role` permanecem sem concessão explícita.

A interface oferece reconciliação apenas sob flag própria, sem nova submissão. Resultado confirmado com identidades conferidas encerra a tentativa local correspondente; resultado indeterminado, erro ou mudança da tentativa conserva o bloqueio. Verificação e retry mantêm o mesmo request. Isso não libera 1:N nem substitui testes de concorrência, isolamento e revisão adversarial.
