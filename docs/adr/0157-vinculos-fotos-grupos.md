# ADR-0157 — Vínculo privado de fotos de Grupos Quantitativos

## Contexto

S176 prevê fotos no detalhe do Local. Grupo possui identidade e histórico próprios, mas não há vínculo canônico de fotografia nem fluxo comprovado de upload ou leitura privada para esse objeto.

## Decisão

Preparar vínculo aditivo a objeto privado já existente, em bucket próprio, com Cliente/Grupo/ator, identificador imutável, autorização vigente e trilha de auditoria. O caminho precisa estar no prefixo daquele Cliente/Grupo e objeto ser do próprio ator; sem expor caminho na listagem de metadados. O gate de escrita fica fechado e funções revogadas. Não criar bucket nem políticas, enviar ou baixar arquivos nesta migração.

## Limites

Isto não implementa fotos utilizáveis: faltam bucket e políticas de upload seguro, validação efetiva do conteúdo, rota intermediada autenticada, recuperação e remoção/retenção, UI e integração com levantamentos. Nenhuma URL assinada ou bytes é produzida. Não ativar/aplicar isoladamente; revisar Storage, isolamento, permissões, transações e testar antes do rollout.
