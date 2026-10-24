# Decisões do Plano de Manutenção

Consolidação da conversa com Lucas e das respostas do Fabrício recebidas em 16/10/2026.
Preservada em 24/10/2026 para continuação em outro computador. Esta é uma base de negócio
para as futuras specs, não uma declaração de implementação.

## Regras de precedência

Lucas determinou que o fluxo proposto pelo Fabrício deve prevalecer. Limitações do código
atual são impactos técnicos a resolver, não motivos para alterar a operação aprovada.
A exceção confirmada por Lucas é manter os nomes **Componentes e Sistemas**, além das
identidades, cadastros e códigos atuais. `pcm.equipamentos` continua sendo o nome físico
do cadastro de Componentes; não renomear a tabela como consequência da linguagem de UI.

As respostas consolidadas em `fontes/respostas-fabricio-2026-10-16.txt` prevalecem sobre
trechos incompatíveis do Word v2. Dentro do Word, a seção 14 prevalece sobre o restante.
As planilhas fornecem dados e referências de homologação, sem substituir as regras de negócio.

## Decisões aprovadas

### F01 Abrangência e cadeia operacional

- O novo fluxo vale para preventivas, corretivas, PMOC e chamados manuais.
- Todas essas demandas convergem para o planejamento de Visitas.
- Cadeia definida: Plano → Versão → Rotina → Ocorrência preventiva → Chamado preventivo →
  uma ou várias OS → Visita → uma tarefa Auvo por OS → execução em campo → validação PCM.
  Corretivas/manuais entram pela sua origem própria; não inventar plano preventivo para elas.
- Chamado contém a necessidade total; OS são unidades executáveis planejadas individualmente.
  Não criar cards independentes que dupliquem o Chamado no quadro gerencial.
- Visita tem cliente, posição/unidade conforme árvore atual, data, janela, equipe,
  responsável, horas, deslocamento, várias OS e controle de ciência quando aplicável.

### F02 Calendário contratual e feriados

- Considerar previamente o calendário contratual de Visitas do cliente.
- Quando o dia fixo cair em feriado, não gerar a Visita daquela semana nem a ocorrência
  preventiva correspondente àquela Visita.
- A semana suprimida não conta como Visita prevista, pendente, atrasada, dispensada ou executada.
- Não criar reposição automática. A supressão pode constar apenas na auditoria do calendário.
- O próximo cálculo considera a próxima Visita válida do calendário vigente.
- A interpretação de rotinas mensais/trimestrais ao atravessar esse evento precisa do exemplo
  registrado em P03; a supressão da semana em si já está aprovada.

### F03 Mudança do dia contratual

- Alteração tem data de vigência e recalcula o calendário futuro de Visitas.
- Atualizar plano e ocorrências futuras ainda não confirmadas; feriados consideram o novo dia.
- Preservar Visitas e ocorrências passadas, Visitas extras, exceções e reprogramações aprovadas.
- Não duplicar tarefas Auvo existentes. Quando necessário, usar reprogramação da mesma tarefa.

### F04 Validação e encerramento

- Tarefa concluída no Auvo significa conclusão em campo, não encerramento gerencial automático.
- OS correspondente passa a “Concluída em campo — aguardando validação”.
- PCM valida execução/evidências e pode encerrar cada OS individualmente.
- Encerrar uma OS não encerra o Chamado.
- Chamado pode conter simultaneamente OS encerradas, em validação, em planejamento e trabalho
  ainda sem OS de continuação criada. Não considerar apenas o número de OS abertas para encerrá-lo.
- Todas as OS encerradas mais escopo integral atendido tornam o Chamado “Apto para encerramento”.
  O encerramento final continua dependendo do PCM.
- Ocorrência preventiva registra o resultado da manutenção executada. A pendência técnica
  corretiva só se encerra quando sua condição de origem estiver efetivamente resolvida.
- Registrar usuário, data/hora, decisão, observação, evidências conferidas, devolução e motivos
  de rejeição/reabertura. Eventos repetidos/fora de ordem não podem duplicar execuções.

### F05 Resultado Não OK

- Preventiva integralmente executada pode ser concluída como Não OK.
- Gerar pendência/necessidade corretiva rastreável vinculada à ocorrência, alvo, Local,
  Sistema, checklist, evidências, técnico e data de identificação.
- A preventiva não fica aberta aguardando o conserto; a correção segue seu fluxo próprio.

### F06 Continuação de OS

- Técnico informa o escopo restante e pode sugerir estimativa de horas.
- PCM revisa/valida e pode alterar a estimativa antes do novo planejamento.
- OS anterior pode ser encerrada após validação; suas horas executadas permanecem nela.
- Nova OS contém apenas escopo/esforço restante, tem vínculo visível com a anterior no Chamado
  e gera uma nova tarefa Auvo.
- Capacidade futura considera somente esforço restante, sem duplicar ocorrência e OS.

### F07 Confirmação PCM, cliente e envio Auvo

- Confirmação PCM é obrigatória e autoriza o envio conforme T−24.
- Padrão: não exigir ciência/confirmação do cliente; não bloquear por sua ausência.
- Configuração pode ser por cliente, contrato ou Visita: sem controle; ciência informativa;
  ou confirmação do cliente obrigatória antes do envio.
- Quando aplicável, registrar data, responsável, canal e observação.
- Ao confirmar: acima de 24 h, aguardar gatilho T−24; dentro da janela, enviar imediatamente,
  respeitando a confirmação do cliente quando configurada como obrigatória.
- Uma tarefa Auvo por OS, com criação/atualização idempotente e reconciliação de resultado incerto.
- Reprogramar ou devolver para Demanda/Planejamento preserva a tarefa existente, que pode
  permanecer atrasada até nova programação. Não criar substituta silenciosamente.
- OS de campo sem Chamado entra em conciliação para vínculo existente ou validação de origem.

### F08 Terceiros

- Mostrar horas/demanda externas, acompanhamento Sinérgica, responsável interno, empresa,
  Local, serviço e período previsto.
- Horas do terceiro não consomem capacidade produtiva interna.
- Somente horas Sinérgica de acompanhamento, fiscalização, apoio, acesso ou liberação
  consomem capacidade interna.

### F09 Despesas

- SO controla previsão, realizado, comprovantes, categoria, técnico/equipe, cliente, Visita,
  data e vínculo com registros do Financeiro existente.
- Categorias iniciais: quilometragem, combustível, pedágio, estacionamento, hospedagem,
  alimentação, transporte, materiais emergenciais e outras despesas.
- Se a entrega for incremental, considerar o fluxo completo no desenho desde o início.
- Auvo não é a fonte oficial de despesas. Evitar lançamento financeiro duplicado ao integrar.

### F10 Permissões

- Permissões configuráveis por perfil ou pessoa, nunca nomes hardcoded.
- Supervisor ou operador PCM com permissão específica pode validar execução.
- Identidades autorizadas a gerir planos e política de autoaprovação continuam em P01/P02.
- Permissões devem ser verificadas também no servidor, conforme constituição do projeto.

### F11 Outras regras do Word que permanecem

- Preservar árvore flexível Cliente → Área → Local → locais filhos; sem segunda árvore.
- Componente pertence a zero ou um Sistema; preservar a unicidade existente.
- Seção 14 define alvo exclusivo Sistema ou ativo físico (Componente na linguagem atual).
  O desenho das specs deve respeitar essa decisão, sem impor a sugestão anterior do assistente
  de trocar por um plano obrigatório único de todo o cliente.
- Plano versionado com aprovação/vigência, escopo Manter/Retirar com motivo/data de efeito,
  várias rotinas independentes e checklists versionados.
- Modelos são aplicados por cópia identificada; edição de modelo não altera plano aprovado.
- Recorrência de calendário fixo, ancorada; execução antecipada/atrasada não muda vencimentos.
  Intervalos explícitos em dias/semanas/meses/anos; mês não significa 30 dias ou quatro semanas.
- Prévia da vigência; rascunho/importação não geram OS. Janela operacional padrão de 30 dias.
- Ativação/retomada mostram vencidos para decisão PCM, sem geração silenciosa em massa.
- Preventivas aguardam em fila própria antes de Planejamento e não recebem criticidade corretiva.
- HH = duração × técnicos × quantidade, apenas quando duração for por unidade. Não multiplicar
  de novo um tempo que já é total do Sistema. Comparar demanda/disponibilidade com mesma unidade.
- Tempo ausente/zero pendente não é esforço zero; destacar demanda incompleta.
- Alertas operacionais de capacidade, ausência, conflito, perfil/certificação exigem confirmação
  consciente, mas não bloqueiam nesta fase. Preservar validações de integridade e autorização.
- Semana de capacidade: segunda a domingo. Distinguir vencimento original e data programada.
- Capacidade numérica não comprova simultaneidade nem especialidade da equipe.
- Revisões, retiradas, suspensão e cancelamentos preservam histórico e OS em execução.
- PMOC preserva seus recursos próprios, mas cada rotina tem origem única de geração.
- Importação assistida tem mapeamento, prévia, erros por linha e repetição sem duplicar;
  exportação PDF/planilha identifica cliente, vigência, versão e filtros.
- Liberação de geração real no Auvo depende de validação operacional do Fabrício.
- Os testes T01–T18 e os cenários adicionais da seção 16 são roteiro futuro de homologação,
  não resultados já obtidos.

## Conferência das amostras de planilha

| Amostra | Observado | Consequência para specs/importação |
| --- | --- | --- |
| Rimini | 7 abas; 59 registros (34 de natureza Equipamento e 25 Sistema). | Natureza Equipamento corresponde à UI Componente; mapear os cadastros, sem duplicá-los. |
| Rimini | 25 registros SPCI com tempo 0 explicitamente pendente. | Importar como Tempo a validar; demanda/capacidade incompletas. |
| Rimini | Planejamento executivo S31–S52, de 05/08 a 30/12/2026; 103 h de carga conhecida. | Não interpretar S01–S30 de referência como execução atrasada ou comprovada. Carga não inclui esforço SPCI pendente. |
| Rimini | Base 5,6 h/semana; referência de jornada 8 h; premissas aproximam mensal a 4 semanas e trimestral a 13. | Parâmetros pertencem ao cliente/período; não são defaults universais. Intervalos da fonte precisam de mapeamento explícito. |
| I Home | 3 abas; 53 registros (46 de natureza Equipamento e 7 Sistema). | Preservar as exclusões específicas e mapear somente o escopo realmente fornecido. |
| I Home | Ciclo de 52 semanas de 05/08/2026 a 28/07/2027; 264 HH na referência. | Suportar vigência entre anos; não limitar a janeiro–dezembro nem prometer 52 visitas após suprimir feriados. |
| I Home | Picos de aproximadamente 19,33 HH e equipe equivalente máxima de 3 na referência. | Alertar sobre recurso adicional; equivalência aritmética não comprova agenda/composição viável. |
| Ambas | Mesma data 05/08/2026 aparece como S31 no Rimini e S01 no I Home. | Usar datas e ciclo de origem; não usar rótulo SNN como chave global nem presumir semana ISO. |
| Ambas | X representa programação. Coluna SISTEMA inclui disciplinas como Elétrico/Hidráulico. | X não comprova execução; disciplina não cria automaticamente um Sistema cadastral com esse nome. |

Os totais de esforço foram conferidos contra as linhas e marcações fornecidas. Não houve
alteração dos originais, importação no banco, geração de OS ou homologação de integração.
Datas/quantidades futuras precisam ser recalculadas com o calendário contratual aprovado.

## Pendências que ainda exigem resposta

### P01 Autoridade de gestão

Fabrício reservou a definição de quem pode aprovar, suspender e encerrar planos e autorizar
cancelamentos. Perguntar os perfis/pessoas autorizados; implementar por permissões configuráveis.

### P02 Aprovação pelo próprio planejador

Fabrício reservou se quem elaborou pode aprovar ou exige outra pessoa. A estrutura deve
permitir configurar a política; não adotar uma alternativa como aprovada antes da resposta.

### P03 Recorrência ao atravessar feriado

Validar um exemplo: rotina mensal prevista para a Visita suprimida deve acontecer na próxima
Visita válida, ainda na semana seguinte, ou somente na próxima oportunidade mensal? Caso vá
para a semana seguinte, ciclos posteriores preservam a referência original ou usam a nova data?
Manter aprovadas a inexistência de Visita/ocorrência na semana suprimida e a ausência de reposição
automática. A pergunta fecha o calendário da rotina, não reabre a regra de feriado.

## Impactos técnicos identificados na base atual

- `pcm.planos_preventivos` reúne alvo, recorrência e questionário; precisa evoluir para
  o modelo aprovado de Plano/Versão/Rotinas, preservando ocorrências existentes.
- `supabase/migrations/0171_E01-S129_uma_os_por_chamado.sql` limita Chamado a uma OS ativa.
- `0224_E01-S53_preventivas_pcm.sql` limita a uma OS por ocorrência. As duas regras precisam
  ser redesenhadas para 1..N sem perder idempotência, histórico e referências existentes.
- `application/chamados.ts` e adapters/read models também pressupõem conversão única.
- `pcm-preventivas-confirmar` faz envio imediato quando habilitado; precisa evoluir para
  a política de Visita/T−24 e estados locais de execução/validação separados.
- Agenda atual é `pcm.agenda_tecnico`, alocação por técnico/cliente/horário; não representa
  a Visita completa aprovada. Não confundir `visita_em` de uma ocorrência com essa entidade.
- `_shared/auvo/os-from-task.ts` cria Chamado automático para tarefa de campo sem origem;
  novo fluxo exige conciliação controlada pelo PCM.
- PMOC possui cronograma e criação própria de OS; mapear a origem de geração de cada rotina.
- Sistemas já têm descriptor Auvo com escrita habilitada no código e proteção de duplicidade;
  não assumir o aviso antigo de dry-run observado no documento como diagnóstico atual de produção.
- Reusar lista/timeline/calendário/drawers de Preventivas e a integração com Cliente 360.
- Schema, versões, Visitas, cardinalidades e integração exigem ADR antes da implementação,
  migrations aditivas, permissões de servidor e revisão adversarial antes do PASS.

## Sugestões ainda não convertidas em requisitos aprovados

Foram enviadas: operação concentrada no Cliente 360; fila de ações do PCM; indicadores separados
de execução e validação; comparação de tempos previstos/reais para revisão humana dos modelos;
visão futura de capacidade consolidada entre clientes. A separação execução/validação foi
explicitamente detalhada nas respostas; as demais sugestões precisam ser tratadas segundo seu
suporte no Word e a aprovação posterior, sem ampliar automaticamente o escopo.

## Próximo trabalho

Fechar P01–P03 e preparar uma iniciativa com stories dependentes, preservando os RF01–RF32.
Primeira demonstração: plano, escopo, rotinas, cronograma e capacidade do piloto. Depois,
cadeia Chamado/OS/Visitas, Auvo/T−24, retorno/validação, despesas/integradores e homologação.
Não estimar esforço definitivo nem marcar AC como atendido só com essa análise.
