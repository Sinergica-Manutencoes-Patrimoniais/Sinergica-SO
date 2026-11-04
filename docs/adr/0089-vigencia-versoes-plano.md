# ADR-0089 — Vigência não sobreposta para versões do Plano

## Estado

Proposta em análise, não implementada nem liberada. A segunda aprovação permanece bloqueada até adaptação dos consumidores de vigência.

## Contexto e decisão

Uma revisão deve preservar o conteúdo aprovado e não alterar o passado. A aprovação da primeira versão permanece compatível com a operação existente. Como limitação técnica conservadora desta etapa, aprovação de versão posterior exige data finita estritamente após o dia corrente em UTC e após o início da última versão aprovada. A especificação não proíbe vigência no dia atual: essa limitação não é decisão operacional e precisa ser substituída após definição segura do fuso e dos impactos antes da entrega. UTC é limite conservador para o projeto brasileiro até existir fuso contratual explícito no Plano; não representa decisão de fuso de uma Visita. Datas infinitas não são aceitas.

As datas de vigência são inclusivas: ao aprovar a nova versão, o fim da versão anterior passa a ser o dia anterior ao início da nova. O fechamento, o novo snapshot, a revisão do Plano, o resultado idempotente e a auditoria pertencem à mesma transação sob bloqueio do Plano. Snapshots, IDs, Rotinas e questionários anteriores não são alterados. O banco impede sobreposição por Plano mesmo fora do comando. Transições de fim de vigência previamente preenchido são recusadas; não é permitido alterar data encerrada arbitrariamente.

## Limites e rollout

A prévia atual não identifica todas as Ocorrências e OS afetadas; esta proposta não conclui AC-5. A interface escolhe versão por ordem de UUID e apresenta todas as aprovadas sem distinguir vigência atual ou futura. A proteção existente não deve ser removida enquanto esses consumidores não forem adaptados. A geração de Ocorrências continua bloqueada, assim como qualquer ação Auvo. Antes de disponibilizar operacionalmente: validar prévia de impacto e concorrência, fuso de negócio, desempenho e lock da constraint sobre dados reais, plano de aplicação e reversão, revisão adversarial e CI. Migrations existentes não são reescritas; alterar snapshots ou migrar dados legados está fora desta etapa.
