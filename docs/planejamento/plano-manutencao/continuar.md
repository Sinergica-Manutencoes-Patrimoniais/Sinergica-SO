# Prompt para continuar em outro computador

Copie o texto abaixo para uma nova conversa no checkout deste repositório.

```text
Continue o projeto Sinérgica SO a partir da branch codex/handoff-plano-manutencao.
Se necessário, atualize origin e troque para essa branch sem sobrescrever alterações locais.

Leia CLAUDE.md, AGENTS.md, docs/STATE.md e, nesta ordem:
1. docs/planejamento/plano-manutencao/README.md
2. docs/planejamento/plano-manutencao/decisoes-consolidadas.md
3. docs/planejamento/plano-manutencao/fontes/respostas-fabricio-2026-10-16.txt
4. docs/planejamento/plano-manutencao/fontes/especificacao-fabricio-v2.docx
5. As duas planilhas em docs/planejamento/plano-manutencao/fontes/.

Objetivo: transformar o Plano de Manutenção do Fabrício em especificações executáveis,
com sequência de stories, critérios de aceite e plano de testes, adequadas para execução
pelo modelo Terra. Ainda não houve implementação dessa iniciativa.

As decisões operacionais do Fabrício prevalecem. Lucas determinou manter os nomes atuais
Componentes e Sistemas, cadastros, identidades e códigos. As respostas de 16/10 prevalecem
sobre os trechos incompatíveis do Word; nele, a seção 14 prevalece sobre propostas anteriores.
As planilhas são amostras operacionais e massa de homologação, não prova de execução.

Não reabra decisões já fechadas: fluxo para todos os serviços; Chamado com várias OS;
Visita como contêiner; tarefa Auvo por OS e T−24; validação PCM separada da conclusão em
campo; encerramento individual de OS e próprio de Chamado; preventiva Não OK gera corretiva;
continuação com esforço restante; confirmação do cliente opcional/configurável;
horas de terceiros separadas; despesas oficiais no SO com vínculo Financeiro.

Calendário contratual vem antes da geração. Feriado suprime a Visita e sua ocorrência,
sem reposição automática nem contagem em indicadores operacionais. Mudança de dia fixo
tem vigência e preserva passado, exceções aprovadas e tarefas Auvo existentes.

Há apenas três esclarecimentos registrados: P01 (quem gere/aprova/cancela), P02 (aprovação
do próprio plano) e P03 (exemplo de sequência periódica ao atravessar feriado). Verifique
se Lucas já trouxe novas respostas; se não, pergunte somente o necessário e prossiga com
as partes de especificação independentes, deixando decisões pendentes explícitas.

Observe: Rimini tem 59 registros e 25 tempos SPCI a validar; I Home tem 53 registros e
vigência 2026/2027. S31 de um arquivo pode ser S01 do outro para a mesma data. Zero pendente
não é esforço zero e X é programação. Não invente disciplinas, ativos, tempos ou vínculos Auvo.

Use a base existente de Preventivas E01-S53, mas não trate a iniciativa nova como já
implementada. Confira os impactos de 1..N OS, Visitas, versões, integração, PMOC e Financeiro.
Siga Spec Kit; consulte apenas as linhas relevantes do ROADMAP e confira IDs/owner antes de
abrir stories. Registre ADR para decisões arquiteturais antes de implementar. Esta retomada
prioriza specs, não autoriza disparos reais no Auvo ou deploy. Não replique credenciais.

O levantamento funcional anterior está em docs/entregas/2026-10-14/ (Markdown, HTML e ZIP).
Não refaça esse material nem confunda suas entregas com o novo Plano de Manutenção.
```
