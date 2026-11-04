# ADR-0091 — Origem contratual explícita para Visitas

## Estado

Proposta em análise para E01-S166 e E01-S171. Não implementada, não homologada e sem autorização de rollout. Esta proposta complementa ADR-0053 e ADR-0058; não libera mudança de dia, materialização de Visitas ou geração de Ocorrências.

## Contexto

`pcm.calendario_contratual_series` identifica Cliente e contrato; `pcm.regras_visita_contratual` guarda versões não sobrepostas. `pcm.visitas` guarda contrato, natureza, estado, data e revisão, mas sua definição atual não registra série, versão da regra ou semana contratual de origem. Contrato e data não bastam para descobrir qual série gerou uma Visita: séries distintas podem coexistir e uma Visita pode ter sido movida, criada manualmente ou ser extra. O campo de natureza, isoladamente, não comprova origem. As migrations 0276 e 0282 são a evidência da estrutura local; não são inventário de produção.

Sem vínculo comprovado, uma prévia que alegue impacto completo ou uma alteração automática corre o risco de mover Visitas erradas, perder exceções ou duplicar ciclos. IDs existentes de Visitas, OS e referências Auvo não podem ser recriados nem substituídos. O modelo de origem dos IDs Auvo precisa ser inventariado antes de uma aplicação operacional.

## Direção proposta

- Introduzir vínculo aditivo, específico e auditável entre Visita e origem contratual, com Cliente, série, versão da regra de origem e segunda-feira da semana de origem. A data de origem é civil e independente da data posteriormente reprogramada. Impor no banco a coerência Cliente/contrato entre Visita e série e a relação entre versão e série; não confiar no navegador. A cardinalidade, o histórico e o tratamento de correções precisam ser demonstrados com testes antes de escolher a DDL final.
- Registrar a origem somente quando comprovada pela criação transacional ou por reconciliação explícita, autorizada e auditada. Linhas históricas sem comprovação permanecem sem origem; não inferir automaticamente por contrato, dia, estado, número, proximidade de data ou referência externa. Visitas extra e reposição manual não são automaticamente atribuídas à série ou tratadas como Visitas regulares.
- Preservar o ID e as associações atuais da Visita, OS e eventuais referências externas. Mudança de regra cria nova versão; não reescreve a versão histórica que originou uma Visita. A política para associar nova versão às Visitas futuras elegíveis precisa distinguir origem histórica de regra vigente e preservar rastreabilidade. Não usar atualização em massa de datas ou remoção/recriação de Visitas.
- Prévia de impacto no servidor deve identificar, além dos candidatos, dados não reconciliados e limites de cobertura, feriados, exceções aprovadas, confirmações, reprogramações e referências externas. Não oferecer confirmação como completa enquanto faltar alguma dessas fontes. A decisão usa fuso contratual e data civil; preservar passado, extras, confirmadas, reprogramadas e exceções aprovadas conforme AC-3. Nenhuma mudança cria tarefas no Auvo.
- Escrita futura deve verificar autorização atual para o Cliente, `requestId`, revisão esperada da série e estado revisado de cada Visita afetada. Validar impacto novamente na mesma transação, com bloqueios consistentes e detecção de mudança de estado entre prévia e confirmação; alteração de vigência, nova regra, efeitos elegíveis, resultado idempotente e auditoria devem ser atômicos. Definir ordem de bloqueio com os comandos E01-S171 já existentes antes de implementar, incluindo disputa com confirmação, reprogramação e criação de Visita. Não considerar bloqueio apenas da série suficiente.

## Compatibilidade e implantação

A mudança deve ser expansiva: consumidores existentes continuam lendo Visitas sem vínculo; escritas legadas não passam a presumir origem. Não tornar vínculo obrigatório para dados anteriores sem inventário, reconciliação individual e prova de compatibilidade. Avaliar o impacto de índices, restrições, bloqueios e volume com dados de teste representativos antes de produção; nunca editar migrations já aplicadas.

Em caso de reversão operacional, desabilitar novos comandos e manter vínculos e auditoria para preservação de histórico; não apagar dados como mecanismo de rollback. Plano de rollout e reconciliação exigem etapa específica e aprovação humana. A simulação parcial da interface atual não consulta essas fontes e não é confirmação de impacto nem base suficiente para alteração.

## Evidências exigidas antes de liberar

- pgTAP com dois Clientes: vínculo coerente, vínculos cruzados rejeitados, leitura e escrita negadas quando cabível e permissão revogada; sem escrita direta fora dos comandos autorizados.
- Integridade e histórico: versão da regra pertence à série e contrato/Cliente coerentes; semana em segunda-feira; origem permanece mesmo após reprogramar; Visitas extra, exceções aprovadas e registros antigos sem origem não são modificados. Conferir IDs de Visita, OS e Auvo antes/depois.
- Prévia e transação: sexta feriado, mudança para terça com vigência, Visita confirmada, reprogramada e extra na mesma semana; nenhum reposicionamento automático de feriado. Verificar passado e simultaneidade de origens em séries distintas.
- Duas sessões: confirmação ou reprogramação concorrente com mudança, criação concorrente, revisão obsoleta, repetição idêntica, `requestId` com payload divergente e rollback de falha após cada efeito. Nenhuma atualização parcial nem duplicação de origem.
- Avaliar fuso e virada de dia, paginação e cobertura da prévia, colisões de índices e plano de consultas, CI com db-tests e revisão adversarial. Teste sintético ou prévia hipotética não prova autorização, transação nem dados de produção.
