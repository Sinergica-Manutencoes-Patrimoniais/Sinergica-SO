# ADR-1643 — Consulta mediada da proposta de exigência

A tela de revisão chamava uma função privada de proposta normativa, sem EXECUTE para authenticated, tornando a leitura indisponível mesmo com o gate habilitado.

A consulta passa por mediador autenticado, reutilizando a trava de autorização e a verificação de ator, Cliente e Plano da ADR-1638. O núcleo continua privado e mantém seu gate; a interface confere a sessão antes e depois da leitura. A proposta continua sujeita a reconferência humana e não comprova conformidade. Nenhum gate é habilitado por esta decisão. A migration e a interface aguardam validação antes de homologação.
