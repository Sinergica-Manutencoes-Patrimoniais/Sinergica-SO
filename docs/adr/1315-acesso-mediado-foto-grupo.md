# ADR-1315 — Acesso mediado à foto aceita de Grupo

## Decisão

Preparar duas consultas sob gate fechado: usuário autenticado recebe somente
permissão booleana após o núcleo privado conferir Grupo, decisão e acesso;
serviço recebe o caminho e IDs internos apenas em função exclusiva de
`service_role`. A Edge Function consulta a permissão, localiza e baixa
o objeto, reconfere permissão e identidade do objeto antes de devolver bytes
sem cache. O navegador não recebe o caminho nem acesso direto ao bucket.
Na reconsulta, compara também a atualização informada pelo Storage, para
detectar mudanças observáveis do objeto durante a leitura. Fotos do caminho
legado não têm hash confiável da origem: essa comparação não autentica os
bytes nem detecta alteração que não mude os metadados.

O serviço é privilegiado e deve manter credencial fora do cliente. A dupla
consulta reduz, mas não elimina, a janela entre a última checagem e a entrega.
A foto não comprova origem Auvo ou execução. A rota e o gate ficam fechados.

## Antes de habilitar

Testar permissões e JWT reais, revogação/transferência nas duas ordens,
decisão alterada, conteúdo e limites, objetos substituídos, timeouts,
RLS/FORCE, políticas de Storage, vazamento de caminho, rollout coordenado
e revisão adversarial. Não usar links assinados nem acesso direto do cliente.

## Dependência de rollout da rota existente

Com `SSO_FOTO_GRUPO_MEDIADA_ENABLED` desligada, a Edge chama o núcleo privado sem EXECUTE para usuários autenticados; a foto fica indisponível. A disponibilização depende de implantação coordenada da migration 1462, da Edge, das flags de interface e serviço e dos gates transitivos, seguida dos testes e revisão acima. Não liberar o caminho privado nem tratar a flag desligada como funcional.
