# ADR-0794: OS sem Visita em snapshot parcial

Status: proposta; gates fechados, homologação pendente.

OS sem vínculo ativo de Visita têm estado atual e podem ter `data_agendada`, porém não possuem fuso próprio confiável. Incluir uma OS na semana programada somente quando o resolvedor 0726 comprovar origem única, alvo e snapshot e a versão tiver fuso IANA congelado válido. Se o gate ou a permissão `execucao.validar` do resolvedor faltar, a OS segue pendente de semana. Na ausência de agendamento, usar vencimento original da ocorrência legada do mesmo Cliente; não substituir agendamento sem fuso pelo vencimento. Expor status e data de referência como dados, nunca como execução comprovada. OS `finalizado` e `cancelado` não integram esta faixa de OS abertas.

Uma contagem de OS abertas sem semana comprovada é exibida separadamente e não é atribuída a uma semana arbitrária. Se houver mais de uma origem, fuso ausente/inválido, ou nenhuma data confiável, a OS permanece nessa contagem pendente. A lista semanal é limitada a 100; limites ou ausência de cobertura mantêm o snapshot incompleto. Declarações de HH seguem não comprovadas. O snapshot STABLE v2 agrega a fonte adicional na mesma instrução das fontes 0990, conserva os gates e permissões anteriores e não modifica dados.

Faltam cobertura de origens não vinculadas ao legado ou Grupo (que o resolvedor 0726 não valida), semântica de planejamento, medição de desempenho do resolvedor por OS, testes concorrentes e revisão adversarial antes de qualquer abertura. A contagem de pendentes não representa uma semana nem autoriza saldo ou demanda completa.
