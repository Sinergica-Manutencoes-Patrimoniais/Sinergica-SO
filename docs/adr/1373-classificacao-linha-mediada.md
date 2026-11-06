# ADR-1373 — Classificação mediada de linha comercial

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Preparar entradas mediadas para consultar, declarar e revisar a classificação de uma linha comercial como serviço ou material. Leitura e escrita têm gates separados, ambos inicialmente fechados. A declaração exige capacidade comercial; a revisão exige validação e conserva a separação de autores do núcleo. A leitura aceita qualquer uma das duas capacidades. Trava de autorização, gate original e validações de Cliente/versão continuam obrigatórios. Nenhuma ação cria faturável.

## Limites

Validar ACL/RLS/FORCE, identidade, sessão, concorrência, gates, idempotência, revisão da proposta e segregação antes da ativação, com revisão adversarial. A classificação não comprova execução ou exclusividade financeira.
