# ADR-0138 — Código de rascunho comprovado

## Estado

Proposta E01-S177, não aplicada nem homologada; complementa ADR-0112.

## Decisão

Criar registro privado explícito de ciclo de vida do código, com revisão e marcos monotônicos de primeiro uso. Somente ativos nascidos por fluxo transacional que comprove rascunho não utilizado poderão receber esse registro. Cadastros anteriores sem evidência permanecem protegidos, sem inferir que são rascunho. Comando transacional preparado para alterar código de rascunho valida capacidade, revisão, código anterior, conflito com códigos e aliases, sincronização e vínculo a OS, com auditoria e retry. A permissão interna do trigger é limitada à transação; correção excepcional com alias permanece separada.

## Gates

Não existe ainda fluxo de criação que insira o registro de rascunho ou garanta registro atômico dos quatro marcos de uso em todos os escritores, integrações e etiquetas. O comando permanece revogado e com gate privado desligado; não ativar enquanto essas integrações, corrida de uso/edição, cobertura de todas as referências e gatilhos Auvo não forem resolvidos e testados. Consulta defensiva de OS e sync não substitui esse registro. O modelo atual dos códigos admite somente Sistema e itens na tabela legada de Equipamentos; política de Grupo e formato/unicidade reais continuam dependentes de compatibilidade. Nunca alterar códigos legados ou enviar Auvo na aplicação da migration.
