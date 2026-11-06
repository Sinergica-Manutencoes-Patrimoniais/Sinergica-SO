# ADR-0159 — Upload e leitura intermediada de fotos de Grupo

## Decisão

Preparar bucket privado para JPEG/PNG limitados a 10 MiB, com upload por caminho de Cliente/Grupo/nonce e capacidade de gestão atual. Operações de leitura e alteração diretas ficam bloqueadas; uma função de borda autenticada resolve o vínculo de foto por ID com autorização atual, baixa por credencial restrita e revalida autorização antes de entregar bytes. A tela usa URLs de objeto em memória, não URLs públicas ou assinadas. Funções de banco ficam revogadas e o gate anterior desligado até rollout coordenado.

## Limites

A verificação de assinatura é apenas identificador de formato, não antivírus nem saneamento; metadados de câmera podem conter dados pessoais. Revisar retenção, órfãos, CSP, política de formatos, permissões e revogação durante streaming, concorrência e rate limit antes de conceder acesso. Nenhuma migration aplicada ou integração testada.
