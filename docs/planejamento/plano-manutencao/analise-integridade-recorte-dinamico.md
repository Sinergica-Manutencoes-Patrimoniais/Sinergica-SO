---
name: "docs-planejamento-plano-manutencao-analise-integridade-recorte-dinamico-md"
description: "Documento Sinérgica SO: Recorte candidato — comportamento e concorrência além da compilação"
alwaysApply: false
---

# Recorte candidato — comportamento e concorrência além da compilação

**Análise estática; não é manifesto de release.** O ensaio de diagnóstico percorreu 648
migrations com duas ações de catálogo artificiais e seis migrations adicionais. Ele demonstra
compilação nessa combinação, não autoriza implantá-la nem confirma comportamento concorrente.

| Migration ausente | Proposta | Evidência, impacto e ACL |
| --- | --- | --- |
| `1675_E01-S53_serializar_materializacao_legada.sql` | **Candidata prioritária para preservar protocolo; não ativar sem revisão.** | Altera a leitura inicial do Plano em `pcm.materializar_ocorrencias_preventivas` para `FOR UPDATE`. A 1714 selecionada faz reserva de ciclo e trava o Plano legado `FOR UPDATE NOWAIT`, além de introduzir consulta de reserva no gerador. Sem 1675, o gerador parte de leitura sem a mesma trava. Não foi demonstrado que haja violação final: triggers e snapshots também interferem; executar prova de duas sessões antes de afirmar segurança. 1675 não adiciona GRANT/REVOKE, mas modifica função legada já executável conforme ACL anterior. |
| `1587_E01-S168_retorno_grupo_chamado.sql` | **Candidata para preservar caminho Grupo/Chamado; revisar como conjunto.** | A 1586 selecionada permite que OS de Grupo tenha Chamado canônico e a 1592 selecionada admite esse Chamado no consumidor coordenado. Sem 1587, classificador e prévia de cobertura ainda exigem `os.chamado_id is null` para Grupo, podendo recusar o caminho aceito pela 1586/1592. A migration altera duas funções privadas e revoga EXECUTE de public/anon/authenticated/service_role; não concede capacidade. Verificar 0903/0905 e demais predecessoras antes de incluí-la. |
| `1591_E01-S168_cobertura_grupo_chamado.sql` | **Candidata junto com 1587 para consistência da mesma origem.** | Ajusta a guarda de cobertura para aceitar somente Chamado do ciclo de Grupo, como 1586/1592. Sem ela, a guarda mantém a exigência de Chamado nulo. Revoga EXECUTE da função privada; não cria concessão. Depende da forma da função após 0904 e do resolver privado da 1586. |
| `1588_E01-S173_pendencias_grupo_chamado.sql` | **Candidata para manter pendências consistentes com 1586/1592; requer cadeia adicional.** | Ajusta registrador e descrição histórica de pendência para reconhecer somente Chamado canônico de Grupo; sem ela, esses caminhos mantêm Chamado nulo. Revoga EXECUTE das duas funções privadas. Sua segunda substituição exige formato introduzido por 0907; não incluí-la isoladamente. |
| `0907_E01-S173_consumidores_origem_grupo.sql` e `0669_E01-S173_rastreabilidade_pendencia.sql` | **Candidatas em ordem para avaliar 1588, não incluir cegamente.** | 0907 adapta a descrição histórica para origem Grupo e cria `sso_origem_pendencia_v2`, que chama função da 0669. 0669 cria gate de rastreabilidade fechado e funções privadas com checagem de `execucao.validar` e `chamado.escopo.gerir`; também referencia tabelas de composição/parcelas de outras stories. Ambas revogam EXECUTE de funções internas; revisar dependências transitivas e ACL antes de selecionar. 0891, 0906 e 1586 já constam do manifesto/overlay diagnóstico, mas isso não prova fecho. |

Os arquivos `1589` e `1593` também tratam leitura/conferência de Grupo/Chamado, mas não foram
demonstrados necessários para as cadeias acima. Não incluí-los automaticamente; avaliar seus
consumidores e o escopo funcional. A 1586 já selecionada por si só envolve S167, criação/vínculo
de OS e guardas próprias; preservar uma parte de sua sequência sem o restante não constitui
aprovação dessa funcionalidade.

## Limites para decidir inclusão

- Antes de incluir qualquer item em release, comparar a definição esperada de cada função com o
  estado da base, revisar gates, RLS, privilégios, riscos de lock e efeitos de outras stories.
- Para 1675, exercitar em duas sessões materialização, edição e reserva do mesmo Plano, inclusive
  cancelamento/rollback e cron desligado, sem tarefa Auvo. Não pressupor que passar SQL prove isso.
- Para 1587/1588/1591, testar Grupo com Chamado do ciclo, sem Chamado, de outro Cliente/ciclo,
  vínculo legado e revogação de capacidade. Confirmar que alterações continuam privadas e que
  gates dos consumidores permanecem fechados.
- As 0323/0334 seguem necessárias ao catálogo usado em 0415 no release histórico, mas introduzem
  S180/S172 e grants autenticados; seeds artificiais do ensaio não substituem revisão ou migrations.
- Enquanto o escopo de outras stories e o fecho completo não forem aprovados e validados, manter
  o manifesto de release inalterado e o ensaio identificado como diagnóstico não implantável.
