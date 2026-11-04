# ADR-1151 — Trava de transição para envio legado Auvo

Status: proposta local, não implantada nem homologada.

Preparar bloqueio operacional dos caminhos legados de criação de tarefa por OS e confirmação preventiva por meio de `SSO_BLOQUEAR_ENVIO_LEGADO_AUVO=true`, desligado por padrão para preservar compatibilidade. A borda de abertura continua permitindo prévia e informando o bloqueio; a função interna recusa nova criação após consultar o vínculo existente. O caminho preventivo recusa antes de reservar a ocorrência. A validação externa legada também é bloqueada antes de alterar o contrato ou criar task-teste. Nenhuma função delega automaticamente ao novo executor.

A variável é uma trava de implantação, não um fence transacional. Sua alteração não interrompe requisições já iniciadas, não coordena múltiplas instâncias e não cobre todos os caminhos legados. Antes da transição, inventariar e isolar todos os escritores, coordenar versões e instâncias, aguardar ou reconciliar chamadas em voo, comprovar permissões e contrato Auvo, testar e realizar revisão adversarial. Não ativar nem retirar compatibilidade antes de existir substituto operacional homologado.
