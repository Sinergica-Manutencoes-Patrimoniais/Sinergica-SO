# ADR-1473 — Pré-condições de impacto mediadas

Status: preparação local, gate desligado. Complementa ADR-1471.

A tela de revisão registra uma fotografia parcial de pré-condições sem aprovar a versão. Preparar entradas autenticadas para registro e histórico, com capacidade `plano.gerir`, sessão, Cliente e locks dos gates. O núcleo privado mantém serialização, requestId, revisão e auditoria; a mediação preserva repetição do mesmo pedido. A fotografia não comprova cobertura nem autoriza aprovação.

Antes de habilitar, revisar ordem das travas, protocolo global, mudança de Cliente, replay, revogação, RLS/FORCE e testes concorrentes. Não autoriza deploy, aprovação ou efeito externo.
