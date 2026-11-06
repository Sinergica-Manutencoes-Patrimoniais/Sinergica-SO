# ADR 0762 — Isolamento de fotos com digest dos caminhos legados

## Decisão

Fotos confirmadas pela reserva interna 0968 não podem ser entregues por resolutores legados que não validam digest. Os resolutores de foto de levantamento, foto vinculada a Sistema/Componente, Grupo, Equipamento e Localização preservam seus controles e recusam essas fotos. Novos vínculos dessas fotos nas tabelas legadas de ativo, Grupo e Localização também são recusados, até existir fluxo de leitura com digest comprovadamente integrado. O bloqueio aplica-se independentemente do gate: falhar fechado não deve depender da interface.

Fotos sem reserva confirmada continuam seguindo os contratos anteriores. A migração não altera objetos nem códigos, não expõe endpoint e não prova que o digest foi calculado corretamente. O service role e administradores com acesso direto ao Storage continuam sendo fronteiras privilegiadas fora dessas RPCs; a solução não afirma imutabilidade física.

Os cinco resolutores são substituídos com `CREATE OR REPLACE`, preservando seus OIDs e privilégios revogados. Renomear e recriar deixaria dependências SQL preexistentes apontando para a função antiga, contornando a guarda. Os corpos anteriores e seus controles continuam incorporados à nova definição.

## Verificação e implantação

Testar em banco isolado com fotos legadas e com reserva, os cinco resolutores, três tipos de vínculo, gates, permissões e replay. A reserva 0968 deve permanecer interna e desabilitada; testar somente com dados sintéticos e rollback. Antes de ativar novo fluxo, é preciso implementar leitura que compare bytes ao digest protegido, fechar outros caminhos diretos, revisar concorrência e auditar as fronteiras privilegiadas. Não remover os bloqueios sem implantação coordenada do fluxo seguro completo.
