# ADR-0116 — Preparação da materialização por Rotina e alvo

**Estado:** proposta não aplicada nem homologada. Complementa ADR-0076, ADR-0077 e ADR-0114.

## Decisão

Preparar materialização isolada de Rotinas por calendário, baseada no snapshot aprovado e cálculo de ciclo já existente. Cada registro guarda Rotina lógica, alvo, vencimento original e snapshot de tolerâncias; unicidade usa Rotina lógica, tipo e ID do alvo e vencimento, sem depender da versão. A execução limitada a hoje até hoje + 30 dias não gera atrasados retroativamente e não cria Chamado, OS, Visita ou tarefas Auvo. O comando exige origem de geração explicitamente atribuída ao Plano para a Rotina e alvo, e recusa origem PMOC ou não definida; não presume que ausência de PMOC prove exclusividade.

A tabela é fundação separada, não substitui `pcm.ocorrencias_preventivas`: o legado exige `planos_preventivos` e sua identidade não representa Rotina/versão/alvo. Sem vínculo, migração e reconciliação de dados e consumidores, não existe ocorrência canônica operacional completa nem proteção entre geradores. Gate fechado, execução revogada e sem frontend; não ativar.

## Riscos e pendências

Identidade por vencimento é hipótese de transição: mudança de âncora/regra e versões sucessivas podem representar mesmo ciclo com datas distintas; definir identidade estável e impedir duplicação entre versões antes de qualquer liberação. A atribuição de origem ainda não tem comando auditado, não protege alterações diretas do PMOC nem prova exclusividade. Falta modo por Visita, feriados e auditoria de supressão, tratamento de vencidos, cancelamento e fila, vínculo com legado/Chamados, suporte a grupos e alvos ativos e revogação concorrente. Fuso de janela fixado em America/Sao_Paulo é premissa sujeita a confirmação técnica, não informação contratual universal. Testar snapshot, precisão, RLS, concorrência, PMOC, rollbacks e revisão adversarial. Não aplicar ou ligar gate antes de completar esses pré-requisitos.

0340 prepara vínculo auditado de registro preparado a ocorrência legada existente após conferir Cliente, alvo e vencimento; não fabrica `planos_preventivos`, questionário ou tipo de tarefa e não altera fila. A tabela de identidades é explícita, mas o vínculo 1:1 ainda não mapeia mudanças de vencimento/versão para o mesmo ciclo e a materialização 0337 não a consulta: não resolve duplicação entre versões nem integração operacional. Chamados, fila, grupos, originadores PMOC e escritores legados continuam sem compatibilidade transacional. Ambas as funções permanecem fechadas e precisam de redesenho coordenado antes de liberação.
