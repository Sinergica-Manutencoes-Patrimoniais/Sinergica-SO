# ADR 0718 — Mediação de fotos de Sistema e Componente

## Decisão

A listagem de vínculos temporários usa uma função mediadora autenticada, que delega à consulta existente e mantém suas verificações de Cliente e gates. A resolução do caminho privado é exclusiva do serviço, que recebe a identidade validada pelo endpoint e executa a consulta existente no contexto dessa identidade. O caminho não é entregue ao navegador; o endpoint revalida a autorização depois do download.

O modelo permanece temporário e limitado a Sistema e Componente. Não são modificados os gates, critérios de aceite, adequação, retirada, bucket ou permissões das funções internas. O vínculo de fotos e Equipamentos continuam fora desta alteração.

## Consequências

A implantação depende de revisão de segurança, testes integrados, aplicação ordenada da migration e publicação coordenada do endpoint. Nenhum gate é habilitado por esta decisão; não se afirma que fotos antigas sejam adequadas ou publicadas.
