# ADR-1244 — Fundação da identidade de código de Grupo Quantitativo

**Status:** proposta local, não homologada.

## Decisão

Preparar registro privado de códigos de Grupo Quantitativo, ligado ao UUID e Cliente já existentes, sem criar TAG por unidade nem alterar os códigos de Sistemas e Componentes. Cada código permanece reservado no histórico; correção futura deverá preservar o anterior como alias. A atribuição inicial privada valida autorização atual, formato, Grupo e colisões conhecidas sob a trava global existente. Nenhuma função é concedida ou exposta nesta etapa.

## Limites para integração

A tabela isolada ainda não garante unicidade global: os escritores de Sistemas, Componentes, aliases e reservas precisam consultar o registro de Grupos sob a mesma trava, inclusive em concorrência. Falta comando transacional de substituição administrativa e alias, consulta unificada, incorporação de staging individual e em lote, migração dos consumidores e reconciliação dos códigos legados. Não conectar, conceder acesso, ativar gates ou remover as guardas existentes até concluir esses caminhos e testar RLS, concorrência, replay, rollback e revisão adversarial. A migration é aditiva e não altera dados oficiais ou dispara integração externa.
