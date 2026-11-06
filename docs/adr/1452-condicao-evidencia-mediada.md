# ADR 1452 — Condição de evidência mediada

Diagnóstico, histórico e registro de condição de evidências usam entradas autenticadas com autorização atual do Cliente e retorno, coordenação de autorização e gates de leitura/escrita existentes. Núcleos permanecem privados; a condição não comprova conteúdo nem aprova a execução.

Validar autenticação, replays, concorrência, isolamento, ACL, paginação e revisão adversarial antes de habilitar.
