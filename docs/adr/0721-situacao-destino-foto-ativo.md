# ADR 0721 — Situação atual do vínculo de foto

## Decisão

A consulta mediada de destino acrescenta a inadequação vigente e o estado ativo do destino incorporado. Esses indicadores não modificam nem apagam o vínculo, não comprovam publicação ou segurança do conteúdo e não substituem a verificação feita no acesso ao arquivo.

A consulta mantém as permissões e gate do núcleo. O comando de vínculo não é modificado: uma repetição idêntica ainda pode recuperar o resultado histórico, mesmo quando a situação atual tiver mudado. A interface impede novas tentativas quando inadequada ou destino inativo, mas preserva o retry pendente.
