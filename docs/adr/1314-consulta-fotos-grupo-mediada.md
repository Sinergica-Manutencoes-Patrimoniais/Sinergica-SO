# ADR-1314 — Consulta mediada das fotos aceitas de Grupo

## Decisão

Preparar entrada autenticada para listar identificadores de fotos aceitas de
um Grupo do Cliente, sem expor caminhos ou bytes. A entrada mantém os gates
originais, confere sessão, Cliente e capacidade, segura a trava de autorização
e o Grupo durante a consulta. O núcleo existente filtra pela última decisão.

O acesso à imagem é separado e permanece bloqueado: o endpoint existente
depende de consulta privada de caminho ainda não mediada com segurança.
Não conceder acesso direto ao bucket ou expor caminho como atalho.

## Antes de habilitar

Validar revisão e revogação de fotos, transferência/exclusão do Grupo,
concorrência, RLS/FORCE, paginação, permissões, desempenho e revisão adversarial.
