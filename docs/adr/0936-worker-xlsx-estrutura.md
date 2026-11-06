# ADR-0936 — Preparação isolada de leitura XLSX para estrutura

Status: proposta, não homologada nem conectada à interface. Complementa ADR-0935.

## Decisão

Preparar worker de navegador para extração e interpretação OOXML usando parser XML estrito fixado em `@xmldom/xmldom` 0.9.12. O worker calcula digest, enumera abas visíveis e processa somente aba escolhida; o chamador termina o worker no cancelamento, erro ou prazo. Os dados ficam em memória e não são enviados a serviços nem incorporados ao cadastro.

## Limites e reversão

Worker terminável não comprova limite de memória do navegador, segurança contra arquivos hostis ou exatidão equivalente a todos os produtores XLSX. Hash local não autentica dados enviados ao servidor. Não habilitar ou conectar a entrada de usuário até testes de recursos, segurança, compatibilidade com fontes, autorização e revisão adversarial. Desativar consumidor e manter dados existentes; nenhuma mudança de banco ou operação externa é realizada.
