# ADR-0075 — Evolução compatível das Ocorrências preventivas

**Status:** decisão técnica para implementação faseada; sem migration ou geração nesta etapa.

## Contexto

`pcm.ocorrencias_preventivas` já é referenciada por OS, avaliações, achados e telas. Sua origem obrigatória é `pcm.planos_preventivos`, com unicidade `(plano_id, indice)`, e a função legada materializa desde a primeira data. O Plano novo usa versões de Rotinas, alvo único, modos por Visita e calendário, tolerâncias e ciclos estáveis entre revisões. A política legada de leitura usa módulo PCM amplo, enquanto o novo programa exige autorização por Cliente. Substituir a tabela, inventar Planos preventivos legados para alimentar a nova origem ou liberar geração retroativa produziria identidade duplicada, acesso indevido ou retrabalho operacional.

## Decisão

Evoluir a identidade existente de Ocorrência de modo aditivo, preservando seus UUIDs e as referências atuais de OS, avaliações e achados. Introduzir explicitamente origem legada ou origem de Rotina versionada, com integridade que impeça mistura de origens; não reclassificar registros legados sem vínculo comprovado. A origem nova deve guardar Cliente, identidade lógica da Rotina, versão aprovada, alvo tipado, ciclo estável, vencimento original, modo e tolerâncias congelados. A identidade de ciclo deve sobreviver à revisão e a cancelamento, e sua reserva deve ser protegida no banco. Mapeamento de ciclos em revisões deve ser explícito, não inferido apenas do número da versão.

Antes de admitir a origem nova, adaptar os leitores e escritores que pressupõem `plano_id` legado, incluindo RLS e consultas de OS, para que cada origem tenha autorização e apresentação próprias. A autorização nova deve ser validada por Cliente no servidor, inclusive para avaliações e achados; políticas permissivas legadas não podem conceder leitura da origem nova. Manter a materialização legada restrita à origem legada e inalterada para registros antigos. A geração nova não chama Auvo nem modifica automaticamente registros históricos.

## Sequência e gates

1. Mapear e testar os consumidores de `plano_id`, `indice`, `chave_externa`, origem de OS e políticas de Ocorrências, avaliações e achados, inclusive clientes com permissões diferentes.
2. Adicionar campos/ponte e validações sem alterar dados legados; não liberar gravação da origem nova enquanto leitores, RLS e filtros não forem compatíveis. Constraints existentes permanecem até a migração de compatibilidade comprovada.
3. Implementar criação transacional com snapshot aprovado, revisão, auditoria e idempotência; a chave de ciclo não depende exclusivamente de `versao_id`. Concorrência e repetição devem produzir um único ciclo ou conflito explícito. Para Visita, suprimir feriado contratual sem gerar Ocorrência; para calendário, preservar vencimento em feriado.
4. Separar vencidos para decisão PCM, manter cancelamentos e bloquear concorrência com PMOC até prova de origem única. Validar compatibilidade de recuo antes de liberar o novo escritor.
5. Homologar regressão de fila e histórico legados, acesso por Cliente, isolamento de origem, reprogramação, revisão, ciclos entre versões, rollback parcial e duas sessões. Revisão adversarial obrigatória antes de PASS.

## Reversão

Desativar o escritor novo e manter dados, chaves e auditoria já criados. Não remover colunas, reativar ciclos ou converter a origem automaticamente. Leitores compatíveis devem permanecer disponíveis enquanto houver Ocorrências novas. Qualquer operação destrutiva ou reconciliação de dados exige plano e autorização próprios.
